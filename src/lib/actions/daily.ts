'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth'
import { writeLog } from '@/lib/actions/log'
import {
  dailyReportInputSchema,
  dailyReactionInputSchema,
  dailyReactionRemoveSchema,
} from '@/lib/validation/daily'
import { todayStringOral } from '@/lib/utils/date'

/**
 * Запись о работе внутри дейли-отчёта. Ровно одно из direct_task_id / project_task_id /
 * stage_id должно быть NOT NULL (либо все NULL — ручной ввод названия).
 */
export type DailyTaskEntry = {
  direct_task_id:  string | null
  project_task_id: string | null
  stage_id:        string | null
  task_title:      string
  hours_spent:     number
  is_completed:    boolean
}

export type DailyReportInput = {
  did_today:     string
  plan_tomorrow: string
  has_blocker:   boolean
  blocker_text:  string
  workload:      number
  tasks:         DailyTaskEntry[]
  /**
   * Опциональная дата отчёта (YYYY-MM-DD). Разрешено только «сегодня» или
   * «вчера» по Asia/Oral. Если не передана — берётся сегодня. RLS в БД
   * дублирует ограничение окна (миграция 062).
   */
  report_date?:  string
}

export async function submitDailyReport(input: DailyReportInput) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = dailyReportInputSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  // Окно «сегодня + вчера» по Asia/Oral. Сервер — единственная точка истины,
  // потому что клиентский UTC может отставать на 5 часов.
  const today = todayStringOral()
  const yesterday = (() => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  })()
  const reportDate = data.report_date ?? today
  if (reportDate !== today && reportDate !== yesterday) {
    return { error: 'Можно сдать отчёт только за сегодня или вчера' }
  }

  // Был ли уже отчёт за эту дату — определяет, лог-action submitted vs updated.
  const { data: existingReport } = await supabase
    .from('daily_reports')
    .select('id')
    .eq('author_id', userId)
    .eq('report_date', reportDate)
    .maybeSingle()
  const isNew = !existingReport

  const { data: report, error } = await supabase
    .from('daily_reports')
    .upsert(
      {
        author_id:     userId,
        report_date:   reportDate,
        did_today:     data.did_today.trim(),
        plan_tomorrow: data.plan_tomorrow.trim() || null,
        has_blocker:   data.has_blocker,
        blocker_text:  data.has_blocker ? data.blocker_text.trim() || null : null,
        workload:      data.workload,
      },
      { onConflict: 'author_id,report_date' }
    )
    .select()
    .single()

  if (error) return { error: error.message }

  // Diff-replace задач: пересоздаём только если содержимое реально изменилось.
  // Это снижает шум в activity_log при «отредактировал, ничего не меняя».
  type TaskRow = {
    direct_task_id:  string | null
    project_task_id: string | null
    stage_id:        string | null
    task_title:      string
    hours_spent:     number
    is_completed:    boolean
  }
  const { data: oldTasks } = await supabase
    .from('daily_report_tasks')
    .select('direct_task_id, project_task_id, stage_id, task_title, hours_spent, is_completed')
    .eq('report_id', report.id)

  const hashRow = (t: TaskRow) => JSON.stringify([
    t.direct_task_id, t.project_task_id, t.stage_id,
    t.task_title, Number(t.hours_spent), t.is_completed,
  ])
  const newTasksNormalized: TaskRow[] = data.tasks.map(t => ({
    direct_task_id:  t.direct_task_id  || null,
    project_task_id: t.project_task_id || null,
    stage_id:        t.stage_id        || null,
    task_title:      t.task_title,
    hours_spent:     t.hours_spent,
    is_completed:    t.is_completed,
  }))
  const oldHashes = new Set((oldTasks ?? []).map(t => hashRow(t as TaskRow)))
  const newHashes = new Set(newTasksNormalized.map(hashRow))
  const sameSet   = oldHashes.size === newHashes.size && [...oldHashes].every(h => newHashes.has(h))

  if (!sameSet) {
    await supabase.from('daily_report_tasks').delete().eq('report_id', report.id)
    if (newTasksNormalized.length > 0) {
      const { error: tasksError } = await supabase.from('daily_report_tasks').insert(
        newTasksNormalized.map(t => ({ report_id: report.id, ...t }))
      )
      if (tasksError) return { error: tasksError.message }
    }
  }

  // Автозакрытие отмеченных. Через junction (legacy assignee_id хранит только
  // ПЕРВОГО исполнителя — со-исполнители не смогут закрыть). Для каждой
  // закрытой сущности пишем в activity_log (видимый в «Пульсе») и шлём
  // уведомление автору, чтобы он не узнавал постфактум через журнал.
  const directIds  = data.tasks.filter(t => t.is_completed && t.direct_task_id).map(t => t.direct_task_id!)
  const projectIds = data.tasks.filter(t => t.is_completed && t.project_task_id).map(t => t.project_task_id!)
  const stageIds   = data.tasks.filter(t => t.is_completed && t.stage_id).map(t => t.stage_id!)

  await Promise.all([
    closeDirectTasks(supabase, userId, directIds, reportDate),
    closeProjectTasks(supabase, userId, projectIds, reportDate),
    closeStages(supabase, userId, stageIds, reportDate),
  ])

  // Сдал отчёт за сегодня — вечернее напоминание «сдай дейли» больше не
  // актуально, гасим его (бейдж колокольчика не должен висеть из-за него).
  // Только за сегодня: при сдаче за вчера сегодняшнее напоминание ещё в силе.
  if (reportDate === today) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('type', 'system')
      .eq('title', 'Не забудьте сдать дейли-отчёт')
      .eq('is_read', false)
  }

  // Логируем сам факт сдачи отчёта — будет виден в «Пульсе компании».
  await writeLog(
    supabase, userId, 'daily_report', report.id,
    isNew ? 'daily.submitted' : 'daily.updated',
    {
      report_date: reportDate,
      tasks_count: newTasksNormalized.length,
      hours_total: newTasksNormalized.reduce((s, t) => s + Number(t.hours_spent), 0),
      has_blocker: data.has_blocker,
      workload:    data.workload,
    },
  )

  revalidatePath('/dashboard/daily')
  revalidatePath('/dashboard/daily/team')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/assignments')
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers для автозакрытия. Локальные — 'use server' разрешает только
// async-экспорты, поэтому не экспортируем.
// ─────────────────────────────────────────────────────────────────────────────

async function closeDirectTasks(supabase: SupabaseClient, userId: string, ids: string[], reportDate: string) {
  if (ids.length === 0) return

  // Сужаем до тех, где user реально assignee — обходим RLS-нюанс и заодно
  // получаем title/created_by для лога и уведомления.
  const { data: allowed } = await supabase
    .from('direct_task_assignees')
    .select('task_id')
    .eq('profile_id', userId)
    .in('task_id', ids)
  const allowedIds = (allowed ?? []).map(r => r.task_id as string)
  if (allowedIds.length === 0) return

  const { data: tasks } = await supabase
    .from('direct_tasks')
    .select('id, title, created_by, status')
    .in('id', allowedIds)

  // Закрываем только те, что ещё не done — лишний UPDATE триггерит status_changed_audit.
  const toClose = (tasks ?? []).filter(t => t.status !== 'done')
  if (toClose.length === 0) return
  const toCloseIds = toClose.map(t => t.id as string)

  const { error } = await supabase
    .from('direct_tasks')
    .update({ status: 'done' })
    .in('id', toCloseIds)
  if (error) return

  // activity_log + notifications для каждой закрытой задачи.
  const logRows = toClose.map(t => ({
    actor_id:    userId,
    entity_type: 'direct_task' as const,
    entity_id:   t.id as string,
    action:      'direct_task.completed_via_daily',
    meta:        { title: t.title, report_date: reportDate },
  }))
  const notifyRows = toClose
    .filter(t => t.created_by && t.created_by !== userId)
    .map(t => ({
      user_id:   t.created_by as string,
      title:     'Поручение выполнено',
      message:   `Исполнитель закрыл «${t.title}» через дейли-отчёт`,
      type:      'direct_task_feedback' as const,
      linked_id: t.id as string,
    }))

  await Promise.all([
    supabase.from('activity_log').insert(logRows),
    notifyRows.length ? supabase.from('notifications').insert(notifyRows) : Promise.resolve(),
  ])
}

async function closeProjectTasks(supabase: SupabaseClient, userId: string, ids: string[], reportDate: string) {
  if (ids.length === 0) return

  const { data: allowed } = await supabase
    .from('project_task_assignees')
    .select('task_id')
    .eq('profile_id', userId)
    .in('task_id', ids)
  const allowedIds = (allowed ?? []).map(r => r.task_id as string)
  if (allowedIds.length === 0) return

  const { data: tasks } = await supabase
    .from('project_tasks')
    .select('id, title, created_by, project_id, status')
    .in('id', allowedIds)

  const toClose = (tasks ?? []).filter(t => t.status !== 'done')
  if (toClose.length === 0) return
  const toCloseIds = toClose.map(t => t.id as string)

  const { error } = await supabase
    .from('project_tasks')
    .update({ status: 'done' })
    .in('id', toCloseIds)
  if (error) return

  const logRows = toClose.map(t => ({
    actor_id:    userId,
    entity_type: 'project_task' as const,
    entity_id:   t.id as string,
    action:      'project_task.completed_via_daily',
    meta:        {
      title:       t.title,
      project_id:  t.project_id,
      report_date: reportDate,
    },
  }))
  const notifyRows = toClose
    .filter(t => t.created_by && t.created_by !== userId)
    .map(t => ({
      user_id:   t.created_by as string,
      title:     'Задача выполнена',
      message:   `Исполнитель закрыл «${t.title}» через дейли-отчёт`,
      type:      'project_task' as const,
      // linked_id = project_id, чтобы клик уводил на канбан проекта (как у assignment-уведомления).
      linked_id: t.project_id as string,
    }))

  await Promise.all([
    supabase.from('activity_log').insert(logRows),
    notifyRows.length ? supabase.from('notifications').insert(notifyRows) : Promise.resolve(),
  ])
}

async function closeStages(supabase: SupabaseClient, userId: string, ids: string[], reportDate: string) {
  if (ids.length === 0) return

  const { data: allowed } = await supabase
    .from('project_stage_assignees')
    .select('stage_id')
    .eq('profile_id', userId)
    .in('stage_id', ids)
  const allowedIds = (allowed ?? []).map(r => r.stage_id as string)
  if (allowedIds.length === 0) return

  const { data: stages } = await supabase
    .from('project_stages')
    .select('id, name, project_id, status')
    .in('id', allowedIds)

  const toClose = (stages ?? []).filter(s => s.status !== 'completed')
  if (toClose.length === 0) return
  const toCloseIds = toClose.map(s => s.id as string)

  // updateStageStatus проставляет completed_at и пишет лог — но он работает
  // на одну запись и принимает projectId. Чтобы не плодить N RTT, делаем
  // bulk UPDATE здесь и собственный writeLog. completed_at руками — точно
  // та же логика, что в updateStageStatus.
  const { error } = await supabase
    .from('project_stages')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .in('id', toCloseIds)
  if (error) return

  const logRows = toClose.map(s => ({
    actor_id:    userId,
    entity_type: 'stage' as const,
    entity_id:   s.id as string,
    action:      'stage.completed_via_daily',
    meta:        {
      stageName:   s.name,
      projectId:   s.project_id,
      report_date: reportDate,
    },
  }))
  await supabase.from('activity_log').insert(logRows)
}

// ─────────────────────────────────────────────────────────────────────────────
// Эмодзи-реакции руководителя на чужой дейли-отчёт.
// Один пользователь — одна реакция. Повторный тап с тем же эмодзи = снять.
// С другим эмодзи = заменить (UPSERT). RLS пускает INSERT только manager+.
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleDailyReaction(input: { reportId: string; emoji: string }) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = dailyReactionInputSchema.safeParse(input)
  if (!parsed.success) return { error: 'Некорректные данные' }
  const { reportId, emoji } = parsed.data

  const { data: existing } = await supabase
    .from('daily_report_reactions')
    .select('emoji')
    .eq('report_id', reportId)
    .eq('profile_id', userId)
    .maybeSingle()

  // Если тапнули по тому же эмодзи — снимаем.
  if (existing?.emoji === emoji) {
    const { error } = await supabase
      .from('daily_report_reactions')
      .delete()
      .eq('report_id', reportId)
      .eq('profile_id', userId)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/daily/team')
    revalidatePath('/dashboard/daily')
    return { success: true, removed: true }
  }

  // Иначе UPSERT.
  const { error } = await supabase
    .from('daily_report_reactions')
    .upsert(
      { report_id: reportId, profile_id: userId, emoji },
      { onConflict: 'report_id,profile_id' },
    )
  if (error) return { error: error.message }

  // Уведомляем автора (один раз — при появлении/смене реакции, не при снятии).
  const { data: report } = await supabase
    .from('daily_reports')
    .select('author_id, report_date')
    .eq('id', reportId)
    .single()
  if (report && report.author_id !== userId) {
    await supabase.from('notifications').insert({
      user_id:   report.author_id,
      title:     'Реакция на ваш дейли-отчёт',
      message:   `${emoji} — отзыв на отчёт за ${report.report_date}`,
      type:      'system' as const,
      linked_id: reportId,
    })
  }

  await writeLog(supabase, userId, 'daily_report', reportId, 'daily.reaction_added', {
    emoji,
    report_date: report?.report_date ?? null,
  })

  revalidatePath('/dashboard/daily/team')
  revalidatePath('/dashboard/daily')
  return { success: true, removed: false }
}

export async function removeDailyReaction(input: { reportId: string }) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = dailyReactionRemoveSchema.safeParse(input)
  if (!parsed.success) return { error: 'Некорректные данные' }

  const { error } = await supabase
    .from('daily_report_reactions')
    .delete()
    .eq('report_id', parsed.data.reportId)
    .eq('profile_id', userId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/daily/team')
  revalidatePath('/dashboard/daily')
  return { success: true }
}
