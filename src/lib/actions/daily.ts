'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'

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

  const today = new Date().toISOString().split('T')[0]

  const { data: report, error } = await supabase
    .from('daily_reports')
    .upsert(
      {
        author_id:     userId,
        report_date:   today,
        did_today:     input.did_today.trim(),
        plan_tomorrow: input.plan_tomorrow.trim() || null,
        has_blocker:   input.has_blocker,
        blocker_text:  input.has_blocker ? input.blocker_text.trim() || null : null,
        workload:      input.workload,
      },
      { onConflict: 'author_id,report_date' }
    )
    .select()
    .single()

  if (error) return { error: error.message }

  // Полная замена задач отчёта
  await supabase.from('daily_report_tasks').delete().eq('report_id', report.id)

  if (input.tasks.length > 0) {
    const { error: tasksError } = await supabase.from('daily_report_tasks').insert(
      input.tasks.map(t => ({
        report_id:       report.id,
        direct_task_id:  t.direct_task_id  || null,
        project_task_id: t.project_task_id || null,
        stage_id:        t.stage_id        || null,
        task_title:      t.task_title,
        hours_spent:     t.hours_spent,
        is_completed:    t.is_completed,
      }))
    )
    if (tasksError) return { error: tasksError.message }
  }

  // Автозакрытие отмеченных поручений
  const completedDirectIds = input.tasks
    .filter(t => t.is_completed && t.direct_task_id)
    .map(t => t.direct_task_id!)
  if (completedDirectIds.length > 0) {
    await supabase
      .from('direct_tasks')
      .update({ status: 'done' })
      .in('id', completedDirectIds)
      .eq('assignee_id', userId)
  }

  // Автозакрытие отмеченных проектных задач
  const completedProjectIds = input.tasks
    .filter(t => t.is_completed && t.project_task_id)
    .map(t => t.project_task_id!)
  if (completedProjectIds.length > 0) {
    await supabase
      .from('project_tasks')
      .update({ status: 'done' })
      .in('id', completedProjectIds)
      .eq('assignee_id', userId)
  }

  // Автозакрытие отмеченных этапов проектов
  const completedStageIds = input.tasks
    .filter(t => t.is_completed && t.stage_id)
    .map(t => t.stage_id!)
  if (completedStageIds.length > 0) {
    await supabase
      .from('project_stages')
      .update({ status: 'completed' })
      .in('id', completedStageIds)
      .eq('assignee_id', userId)
  }

  revalidatePath('/dashboard/daily')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/assignments')
  revalidatePath('/dashboard/projects')
  return { success: true }
}
