'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { writeLog } from '@/lib/actions/log'
import { requireAuth, requireManager } from '@/lib/auth'
import {
  createProjectTaskSchema,
  deleteProjectTaskSchema,
  moveProjectTaskSchema,
  reorderProjectTasksSchema,
  submitProjectTaskFeedbackSchema,
  updateProjectTaskStatusSchema,
  updateProjectTaskDeadlineSchema,
} from '@/lib/validation/project-tasks'

// ─────────────────────────────────────────────────────────────────────────────
// Задачи в проектах (project_tasks)
// Создаются директором / менеджером в канбане проекта.
// Всегда привязаны к этапу (stage_id), опционально — к пункту чек-листа.
// ─────────────────────────────────────────────────────────────────────────────

export async function createProjectTask(formData: {
  project_id: string
  stage_id: string
  checklist_item_id?: string | null
  title: string
  description?: string
  assignee_id?: string | null
  priority?: 'low' | 'medium' | 'high' | 'critical'
  deadline?: string | null
}) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = createProjectTaskSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  // Новая задача — в конец списка этапа
  const nextOrder = await nextOrderIndex(supabase, input.stage_id)

  const { data: task, error } = await supabase.from('project_tasks').insert({
    project_id: input.project_id,
    stage_id: input.stage_id,
    checklist_item_id: input.checklist_item_id ?? null,
    title: input.title,
    description: input.description?.trim() || null,
    assignee_id: input.assignee_id ?? null,
    priority: input.priority ?? 'medium',
    created_by: userId,
    status: 'todo',
    order_index: nextOrder,
    ...(input.deadline ? { deadline: input.deadline } : {}),
  }).select('id').single()

  if (error) return { error: error.message }
  await writeLog(supabase, userId, 'project_task', task.id, 'project_task.created', {
    title: input.title,
    project_id: input.project_id,
    stage_id: input.stage_id,
    assignee_id: input.assignee_id,
  })
  revalidatePath(`/dashboard/projects/${input.project_id}`)
  return { error: null, id: task.id }
}

/** Переместить задачу в другой этап. Ставится в конец нового этапа. */
export async function moveProjectTask(taskId: string, newStageId: string, projectId: string) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = moveProjectTaskSchema.safeParse({ taskId, newStageId, projectId })
  if (!parsed.success) return { error: 'Некорректные идентификаторы' }
  const input = parsed.data

  // В новый этап — в конец списка
  const nextOrder = await nextOrderIndex(supabase, input.newStageId)

  const { error } = await supabase
    .from('project_tasks')
    .update({ stage_id: input.newStageId, order_index: nextOrder })
    .eq('id', input.taskId)
  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'project_task', input.taskId, 'project_task.moved', {
    new_stage_id: input.newStageId,
  })
  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return { error: null }
}

/**
 * Переупорядочить задачи внутри одного этапа — клиент шлёт полный список id
 * в нужном порядке, сервер проставляет order_index = индекс в массиве + 1.
 * Используется DnD на десктопе и стрелками на мобильном.
 */
export async function reorderProjectTasks(
  stageId: string,
  orderedIds: string[],
  projectId: string,
) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth

  const parsed = reorderProjectTasksSchema.safeParse({ stageId, orderedIds, projectId })
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  // Параллельные UPDATE — для 10-30 задач это копейки.
  // RPC через SQL был бы атомарнее, но текущая нагрузка не оправдывает.
  await Promise.all(
    input.orderedIds.map((id, idx) =>
      supabase
        .from('project_tasks')
        .update({ order_index: idx + 1 })
        .eq('id', id)
        .eq('stage_id', input.stageId),
    ),
  )

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return { error: null }
}

export async function updateProjectTaskStatus(taskId: string, status: string, projectId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error, warning: null }
  const { supabase, userId } = auth

  const parsed = updateProjectTaskStatusSchema.safeParse({ taskId, status, projectId })
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors, warning: null }
  }
  const input = parsed.data

  const { data: taskInfo } = await supabase
    .from('project_tasks')
    .select('title, assignee_id')
    .eq('id', input.taskId)
    .single()

  const { error } = await supabase.from('project_tasks').update({ status: input.status }).eq('id', input.taskId)
  if (error) return { error: error.message, warning: null }

  await writeLog(supabase, userId, 'project_task', input.taskId, 'project_task.status_changed', {
    status: input.status,
    title: taskInfo?.title,
  })

  // WIP-check после успешного обновления — мягкий warning, не блокирует.
  let warning: string | null = null
  if (input.status === 'in_progress' && taskInfo?.assignee_id) {
    const { getUserWip } = await import('@/lib/wip')
    const wip = await getUserWip(supabase, taskInfo.assignee_id)
    if (wip.state === 'over') {
      warning = `WIP-лимит превышен: в работе ${wip.active} из ${wip.limit}. Заверши одно из текущих.`
    }
  }

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  revalidatePath('/dashboard/tasks')
  return { error: null, warning }
}

/**
 * Inline-смена дедлайна задачи прямо с карточки. Как и updateStageDeadline,
 * лог не пишем (мелкая правка), RLS решает, кому можно. deadline=null — снять.
 */
export async function updateProjectTaskDeadline(taskId: string, deadline: string | null, projectId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }

  const parsed = updateProjectTaskDeadlineSchema.safeParse({ taskId, deadline, projectId })
  if (!parsed.success) return { error: 'Некорректная дата' }
  const input = parsed.data

  const { error } = await auth.supabase
    .from('project_tasks')
    .update({ deadline: input.deadline })
    .eq('id', input.taskId)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  revalidatePath('/dashboard/tasks')
  return { error: null }
}

/**
 * Сотрудник помечает задачу как «Не завершено» с обязательной причиной.
 * Парный к acceptHandover / rejectHandover, но не возвращает задачу в очередь —
 * исполнитель остаётся, директор видит причину провала и решает, что делать.
 */
export async function markProjectTaskFailed(taskId: string, reason: string, projectId: string) {
  const trimmed = reason.trim()
  if (!trimmed) return { error: 'Укажите причину' }
  return submitProjectTaskFeedback(taskId, trimmed, 'failed', projectId)
}

export async function submitProjectTaskFeedback(taskId: string, note: string, status: string, projectId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = submitProjectTaskFeedbackSchema.safeParse({ taskId, note, status, projectId })
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data
  const trimmedNote = input.note.trim() || null

  const { data: taskInfo } = await supabase.from('project_tasks').select('title').eq('id', input.taskId).single()
  const { error } = await supabase.from('project_tasks').update({
    employee_note: trimmedNote,
    status: input.status,
  }).eq('id', input.taskId)
  if (error) return { error: error.message }
  await writeLog(supabase, userId, 'project_task', input.taskId, 'project_task.feedback', {
    status: input.status,
    title: taskInfo?.title,
    note: trimmedNote,
  })
  revalidatePath(`/dashboard/projects/${input.projectId}`)
  revalidatePath('/dashboard/tasks')
  return { error: null }
}

export async function deleteProjectTask(taskId: string, projectId: string) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = deleteProjectTaskSchema.safeParse({ taskId, projectId })
  if (!parsed.success) return { error: 'Некорректные идентификаторы' }
  const input = parsed.data

  const { data: taskInfo } = await supabase.from('project_tasks').select('title').eq('id', input.taskId).single()
  const { error } = await supabase.from('project_tasks').delete().eq('id', input.taskId)
  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'project_task', input.taskId, 'project_task.deleted', {
    title: taskInfo?.title ?? null,
  })
  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return { error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Локальные хелперы (не экспортируем — 'use server' разрешает только async).
// ─────────────────────────────────────────────────────────────────────────────

async function nextOrderIndex(supabase: SupabaseClient, stageId: string): Promise<number> {
  const { data } = await supabase
    .from('project_tasks')
    .select('order_index')
    .eq('stage_id', stageId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ((data?.order_index as number | undefined) ?? 0) + 1
}
