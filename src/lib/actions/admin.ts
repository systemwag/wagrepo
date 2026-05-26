'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'

// ─────────────────────────────────────────────────────────────────────────────
// Админские сервисные операции. Все функции требуют роль admin — это
// дублируется RLS на стороне БД, но проверка здесь даёт ранний возврат
// без удара по сети.
// ─────────────────────────────────────────────────────────────────────────────

export type DbOverview = {
  projects: number
  project_tasks: number
  direct_tasks: number
  project_stages: number
  events: number
  notifications: number
  activity_log: number
  daily_reports: number
  documents: number
  push_subscriptions: number
  polls: number
}

export async function getDbOverview(): Promise<DbOverview | null> {
  const auth = await requireAdmin()
  if (!auth.ok) return null
  const { supabase } = auth

  const tables: (keyof DbOverview)[] = [
    'projects', 'project_tasks', 'direct_tasks', 'project_stages',
    'events', 'notifications', 'activity_log', 'daily_reports',
    'documents', 'push_subscriptions', 'polls',
  ]

  const counts = await Promise.all(
    tables.map(async t => {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
      return [t, count ?? 0] as const
    }),
  )

  return Object.fromEntries(counts) as DbOverview
}

// ─── Универсальный bulk-delete по id ─────────────────────────────────────────

type DeletableTable =
  | 'projects'
  | 'project_tasks'
  | 'direct_tasks'
  | 'events'
  | 'notifications'
  | 'activity_log'
  | 'polls'

// '/dashboard' добавляется ко всем — главная агрегирует виджеты по всем сущностям.
// '/dashboard/me' — личная страница загрузки.
const REVALIDATE_PATHS: Record<DeletableTable, string[]> = {
  projects:        ['/dashboard', '/dashboard/me', '/dashboard/admin', '/dashboard/admin/projects', '/dashboard/projects', '/dashboard/projects/archive', '/dashboard/workload'],
  project_tasks:   ['/dashboard', '/dashboard/me', '/dashboard/admin', '/dashboard/admin/tasks', '/dashboard/tasks', '/dashboard/workload'],
  direct_tasks:    ['/dashboard', '/dashboard/me', '/dashboard/admin', '/dashboard/admin/tasks', '/dashboard/assignments', '/dashboard/assign', '/dashboard/workload'],
  events:          ['/dashboard', '/dashboard/me', '/dashboard/admin', '/dashboard/admin/events', '/dashboard/events'],
  notifications:   ['/dashboard', '/dashboard/admin', '/dashboard/admin/notifications', '/dashboard/notifications'],
  activity_log:    ['/dashboard', '/dashboard/admin', '/dashboard/admin/activity', '/dashboard/activity'],
  polls:           ['/dashboard', '/dashboard/admin', '/dashboard/admin/polls', '/dashboard/admin/notifications', '/dashboard/polls', '/dashboard/notifications'],
}

export async function adminBulkDelete(
  table: DeletableTable,
  ids: string[],
): Promise<{ ok: boolean; deleted: number; error?: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, deleted: 0, error: auth.error ?? 'Нет прав' }
  if (ids.length === 0) return { ok: true, deleted: 0 }

  const { supabase } = auth

  // polls: идём через SECURITY DEFINER RPC (миграция 069). Прямой PostgREST
  // delete упирается в polls_delete RLS (USING created_by = auth.uid()) —
  // даже если миграция 053 расширила её под director/admin, надёжнее
  // обойти RLS явной admin-RPC и заодно атомарно снять orphan-уведомления.
  if (table === 'polls') {
    const { data, error } = await supabase.rpc('admin_delete_polls', { p_ids: ids })
    if (error) return { ok: false, deleted: 0, error: error.message }
    for (const path of REVALIDATE_PATHS[table]) revalidatePath(path)
    return { ok: true, deleted: (data as number) ?? 0 }
  }

  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .in('id', ids)

  if (error) return { ok: false, deleted: 0, error: error.message }

  for (const path of REVALIDATE_PATHS[table]) revalidatePath(path)
  return { ok: true, deleted: count ?? ids.length }
}

// ─── Удаление «всё старше N дней» — для регулярной чистки ───────────────────

// ─── Полная очистка рабочих данных ──────────────────────────────────────────
// Удаляет в порядке, безопасном для FK: сначала зависимые таблицы,
// потом projects (которые каскадно убирают project_stages / project_tasks /
// stage_checklist_items / task_reports / documents с project_id).
//
// НЕ ТРОГАЕТ: profiles, project_templates, template_stages,
// template_checklist_items, push_subscriptions, activity_log.
//
// activity_log сохраняем как историю; чистится отдельной кнопкой «Старше N дней».
const WIPE_ORDER = [
  'daily_reports',  // daily_report_tasks удалится по CASCADE
  'polls',          // poll_targets + poll_responses — CASCADE. Идёт до notifications,
                    //   чтобы триггер уведомлений (если бы был на delete) не успел
                    //   засрать таблицу заново.
  'notifications',
  'events',         // event_participants — CASCADE
  'documents',      // не привязаны к projects могут оставаться (stage_id и т.п.)
  'direct_tasks',   // независимая таблица
  'projects',       // CASCADE: project_stages, project_tasks, stage_checklist_items, task_reports
] as const

type WipeResult = {
  ok: boolean
  deleted: Record<string, number>
  error?: string
}

export async function adminWipeAll(): Promise<WipeResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, deleted: {}, error: auth.error ?? 'Нет прав' }

  const { supabase } = auth
  const deleted: Record<string, number> = {}

  for (const table of WIPE_ORDER) {
    // polls: через RPC (миграция 069) — RLS polls_delete упирается в
    // created_by, прямой DELETE возвращает 0. Собираем все id и сносим.
    if (table === 'polls') {
      const { data: rows } = await supabase.from('polls').select('id')
      const ids = (rows ?? []).map(r => r.id as string)
      if (ids.length === 0) { deleted[table] = 0; continue }
      const { data, error } = await supabase.rpc('admin_delete_polls', { p_ids: ids })
      if (error) return { ok: false, deleted, error: `${table}: ${error.message}` }
      deleted[table] = (data as number) ?? 0
      continue
    }

    // .neq на заведомо несуществующий id — самый портабельный способ удалить
    // всё через PostgREST (он отклоняет DELETE без WHERE).
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) return { ok: false, deleted, error: `${table}: ${error.message}` }
    deleted[table] = count ?? 0
  }

  // Инвалидация всех маршрутов, куда попадают эти данные.
  const ALL_PATHS = [
    '/dashboard',
    '/dashboard/me',
    '/dashboard/admin',
    '/dashboard/admin/projects',
    '/dashboard/admin/tasks',
    '/dashboard/admin/events',
    '/dashboard/admin/notifications',
    '/dashboard/admin/activity',
    '/dashboard/admin/polls',
    '/dashboard/projects',
    '/dashboard/projects/archive',
    '/dashboard/tasks',
    '/dashboard/assignments',
    '/dashboard/assign',
    '/dashboard/events',
    '/dashboard/notifications',
    '/dashboard/workload',
    '/dashboard/deadlines',
    '/dashboard/handover',
    '/dashboard/gantt',
    '/dashboard/daily',
    '/dashboard/daily/team',
    '/dashboard/polls',
  ]
  for (const p of ALL_PATHS) revalidatePath(p)

  return { ok: true, deleted }
}

export async function adminDeleteOlderThan(
  table: DeletableTable,
  days: number,
): Promise<{ ok: boolean; deleted: number; error?: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, deleted: 0, error: auth.error ?? 'Нет прав' }
  if (days < 1) return { ok: false, deleted: 0, error: 'Минимум 1 день' }

  const { supabase } = auth
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)

  if (error) return { ok: false, deleted: 0, error: error.message }

  for (const path of REVALIDATE_PATHS[table]) revalidatePath(path)
  return { ok: true, deleted: count ?? 0 }
}

// ─── Удаление дейли-отчётов по дням ──────────────────────────────────────────
// RLS на daily_reports (миграция 062) пускает только автора в окне
// [вчера..сегодня]. Админ ходит через SECURITY DEFINER функцию (миграция 064).
// daily_report_tasks и daily_report_reactions удаляются по CASCADE.

export async function adminDeleteDailyByDates(
  dates: string[],
): Promise<{ ok: boolean; deleted: number; error?: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, deleted: 0, error: auth.error ?? 'Нет прав' }
  if (dates.length === 0) return { ok: true, deleted: 0 }

  // Серверная валидация формата YYYY-MM-DD — RPC принимает DATE[],
  // некорректная строка свалит вызов 22007/invalid_datetime_format.
  for (const d of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return { ok: false, deleted: 0, error: `Неверный формат даты: ${d}` }
    }
  }

  const { supabase } = auth
  const { data, error } = await supabase.rpc('admin_delete_daily_by_dates', { p_dates: dates })
  if (error) return { ok: false, deleted: 0, error: error.message }

  for (const p of [
    '/dashboard',
    '/dashboard/admin',
    '/dashboard/admin/daily',
    '/dashboard/daily',
    '/dashboard/daily/team',
  ]) revalidatePath(p)

  return { ok: true, deleted: (data as number) ?? 0 }
}

// ─── Уведомления: массовое удаление по типу ──────────────────────────────────
// Кейс: «выкинуть все poll-уведомления одним кликом» — после миграции 067
// (дедуп) накопившиеся дубли проще удалить так, чем выделять чекбоксами.

const NOTIFICATION_TYPES = ['poll', 'event', 'project', 'direct_task', 'project_task', 'system'] as const
type NotificationType = typeof NOTIFICATION_TYPES[number]

export async function adminDeleteNotificationsByType(
  type: string,
): Promise<{ ok: boolean; deleted: number; error?: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, deleted: 0, error: auth.error ?? 'Нет прав' }
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
    return { ok: false, deleted: 0, error: `Неизвестный тип: ${type}` }
  }

  const { supabase } = auth
  const { error, count } = await supabase
    .from('notifications')
    .delete({ count: 'exact' })
    .eq('type', type as NotificationType)

  if (error) return { ok: false, deleted: 0, error: error.message }

  for (const p of REVALIDATE_PATHS.notifications) revalidatePath(p)
  return { ok: true, deleted: count ?? 0 }
}

// ─── Уведомления: чистка осиротевших ─────────────────────────────────────────
// Удаляет notifications, чей linked_id уже не существует в соответствующей
// таблице. RPC из миграции 068 проходит по 5 типам за один вызов.

export async function adminCleanupOrphanNotifications(): Promise<{ ok: boolean; deleted: number; error?: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, deleted: 0, error: auth.error ?? 'Нет прав' }

  const { supabase } = auth
  const { data, error } = await supabase.rpc('admin_cleanup_orphan_notifications')
  if (error) return { ok: false, deleted: 0, error: error.message }

  for (const p of REVALIDATE_PATHS.notifications) revalidatePath(p)
  return { ok: true, deleted: (data as number) ?? 0 }
}
