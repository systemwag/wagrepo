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
}

export async function getDbOverview(): Promise<DbOverview | null> {
  const auth = await requireAdmin()
  if (!auth.ok) return null
  const { supabase } = auth

  const tables: (keyof DbOverview)[] = [
    'projects', 'project_tasks', 'direct_tasks', 'project_stages',
    'events', 'notifications', 'activity_log', 'daily_reports',
    'documents', 'push_subscriptions',
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

// '/dashboard' добавляется ко всем — главная агрегирует виджеты по всем сущностям.
// '/dashboard/me' — личная страница загрузки.
const REVALIDATE_PATHS: Record<DeletableTable, string[]> = {
  projects:        ['/dashboard', '/dashboard/me', '/dashboard/admin', '/dashboard/admin/projects', '/dashboard/projects', '/dashboard/projects/archive', '/dashboard/projects/board', '/dashboard/workload'],
  project_tasks:   ['/dashboard', '/dashboard/me', '/dashboard/admin', '/dashboard/admin/tasks', '/dashboard/tasks', '/dashboard/workload'],
  direct_tasks:    ['/dashboard', '/dashboard/me', '/dashboard/admin', '/dashboard/admin/tasks', '/dashboard/assignments', '/dashboard/assign', '/dashboard/workload'],
  events:          ['/dashboard', '/dashboard/me', '/dashboard/admin', '/dashboard/admin/events', '/dashboard/events'],
  notifications:   ['/dashboard', '/dashboard/admin', '/dashboard/admin/notifications', '/dashboard/notifications'],
  activity_log:    ['/dashboard', '/dashboard/admin', '/dashboard/admin/activity', '/dashboard/activity'],
}

export async function adminBulkDelete(
  table: DeletableTable,
  ids: string[],
): Promise<{ ok: boolean; deleted: number; error?: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, deleted: 0, error: auth.error ?? 'Нет прав' }
  if (ids.length === 0) return { ok: true, deleted: 0 }

  const { supabase } = auth
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
    '/dashboard/projects',
    '/dashboard/projects/board',
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
