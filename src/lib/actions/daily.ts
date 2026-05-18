'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { dailyReportInputSchema } from '@/lib/validation/daily'
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

  // Дата отчёта — в часовом поясе бизнеса (Asia/Oral), не UTC.
  // Иначе в ночные часы по Оралу запись попадает за «вчера» по UTC.
  const today = todayStringOral()

  const { data: report, error } = await supabase
    .from('daily_reports')
    .upsert(
      {
        author_id:     userId,
        report_date:   today,
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

  // Автозакрытие отмеченных — проверяем участие через junction
  // (legacy assignee_id хранит только ПЕРВОГО исполнителя; через `eq('assignee_id', userId)`
  // вторые исполнители не могли бы закрыть задачу).
  async function closeIfAssignee(
    table: 'direct_tasks' | 'project_tasks' | 'project_stages',
    junction: 'direct_task_assignees' | 'project_task_assignees' | 'project_stage_assignees',
    idColumn: 'task_id' | 'stage_id',
    ids: string[],
    nextStatus: 'done' | 'completed',
  ) {
    if (ids.length === 0) return
    const { data: rows } = await supabase
      .from(junction)
      .select(idColumn)
      .eq('profile_id', userId)
      .in(idColumn, ids)
    const allowed = (rows ?? []).map(r => (r as Record<string, string>)[idColumn])
    if (allowed.length === 0) return
    await supabase.from(table).update({ status: nextStatus }).in('id', allowed)
  }

  await Promise.all([
    closeIfAssignee('direct_tasks',   'direct_task_assignees',   'task_id',
      data.tasks.filter(t => t.is_completed && t.direct_task_id).map(t => t.direct_task_id!),
      'done'),
    closeIfAssignee('project_tasks',  'project_task_assignees',  'task_id',
      data.tasks.filter(t => t.is_completed && t.project_task_id).map(t => t.project_task_id!),
      'done'),
    closeIfAssignee('project_stages', 'project_stage_assignees', 'stage_id',
      data.tasks.filter(t => t.is_completed && t.stage_id).map(t => t.stage_id!),
      'completed'),
  ])

  revalidatePath('/dashboard/daily')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/assignments')
  revalidatePath('/dashboard/projects')
  return { success: true }
}
