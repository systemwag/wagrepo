'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type DailyTaskEntry = {
  task_id:      string | null
  stage_id:     string | null
  task_title:   string
  hours_spent:  number
  is_completed: boolean
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const today = new Date().toISOString().split('T')[0]

  const { data: report, error } = await supabase
    .from('daily_reports')
    .upsert(
      {
        author_id:     user.id,
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
        report_id:    report.id,
        task_id:      t.task_id   || null,
        stage_id:     t.stage_id  || null,
        task_title:   t.task_title,
        hours_spent:  t.hours_spent,
        is_completed: t.is_completed,
      }))
    )
    if (tasksError) return { error: tasksError.message }
  }

  // Закрыть задачи отмеченные как завершённые
  const completedTaskIds = input.tasks
    .filter(t => t.is_completed && t.task_id)
    .map(t => t.task_id!)

  if (completedTaskIds.length > 0) {
    await supabase
      .from('tasks')
      .update({ status: 'done' })
      .in('id', completedTaskIds)
      .eq('assignee_id', user.id)
  }

  // Закрыть этапы проектов отмеченные как завершённые
  const completedStageIds = input.tasks
    .filter(t => t.is_completed && t.stage_id)
    .map(t => t.stage_id!)

  if (completedStageIds.length > 0) {
    await supabase
      .from('project_stages')
      .update({ status: 'completed' })
      .in('id', completedStageIds)
      .eq('assignee_id', user.id)
  }

  revalidatePath('/dashboard/daily')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/assignments')
  revalidatePath('/dashboard/projects')
  return { success: true }
}
