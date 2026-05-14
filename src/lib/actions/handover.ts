'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { writeLog } from '@/lib/actions/log'

export type HandoverKind = 'direct' | 'project'

/**
 * Сотрудник принимает поручение / проектную задачу в работу.
 * Меняет статус с 'todo' на 'in_progress'. RLS гарантирует, что обновить
 * можно только свою задачу (assignee_id = auth.uid()).
 */
export async function acceptHandover(kind: HandoverKind, taskId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const table = kind === 'direct' ? 'direct_tasks' : 'project_tasks'
  const { data: taskInfo } = await supabase.from(table).select('title').eq('id', taskId).single()

  const { error } = await supabase
    .from(table)
    .update({ status: 'in_progress' })
    .eq('id', taskId)
    .eq('assignee_id', userId)
  if (error) return { error: error.message }

  await writeLog(
    supabase, userId,
    kind === 'direct' ? 'direct_task' : 'project_task',
    taskId,
    `${kind}_task.accepted`,
    { title: taskInfo?.title ?? null },
  )

  revalidatePath('/dashboard/handover')
  revalidatePath('/dashboard/assignments')
  revalidatePath('/dashboard/tasks')
  return { error: null }
}

/**
 * Сотрудник отклоняет поручение / задачу с причиной. Снимаем себя с задачи
 * (assignee_id = NULL), пишем причину в employee_note. Создатель получает
 * уведомление через триггер на change of assignee_id.
 *
 * Поручение возвращается в журнал директору в статусе 'todo' без исполнителя.
 */
export async function rejectHandover(kind: HandoverKind, taskId: string, reason: string) {
  if (!reason.trim()) return { error: 'Укажите причину отклонения' }
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const table = kind === 'direct' ? 'direct_tasks' : 'project_tasks'
  const { data: taskInfo } = await supabase.from(table).select('title, created_by').eq('id', taskId).single()

  const { error } = await supabase
    .from(table)
    .update({
      assignee_id: null,
      employee_note: `[Отклонено] ${reason.trim()}`,
      status: 'todo',
    })
    .eq('id', taskId)
    .eq('assignee_id', userId)
  if (error) return { error: error.message }

  await writeLog(
    supabase, userId,
    kind === 'direct' ? 'direct_task' : 'project_task',
    taskId,
    `${kind}_task.rejected`,
    { title: taskInfo?.title ?? null, reason: reason.trim() },
  )

  // Уведомление создателю — что задача отклонена.
  if (taskInfo?.created_by && taskInfo.created_by !== userId) {
    await supabase.from('notifications').insert({
      user_id: taskInfo.created_by,
      title: 'Задача отклонена',
      message: `Исполнитель отклонил: "${taskInfo.title}". Причина: ${reason.trim()}`,
      type: kind === 'direct' ? 'direct_task' : 'project_task',
      linked_id: taskId,
    })
  }

  revalidatePath('/dashboard/handover')
  revalidatePath('/dashboard/assignments')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/assign')
  return { error: null }
}
