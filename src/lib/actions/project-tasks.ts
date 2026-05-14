'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { writeLog } from '@/lib/actions/log'
import { requireAuth, requireManager } from '@/lib/auth'

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

  // Новая задача — в конец списка этапа
  const nextOrder = await nextOrderIndex(supabase, formData.stage_id)

  const { data: task, error } = await supabase.from('project_tasks').insert({
    project_id: formData.project_id,
    stage_id: formData.stage_id,
    checklist_item_id: formData.checklist_item_id ?? null,
    title: formData.title.trim(),
    description: formData.description?.trim() || null,
    assignee_id: formData.assignee_id ?? null,
    priority: formData.priority ?? 'medium',
    created_by: userId,
    status: 'todo',
    order_index: nextOrder,
    ...(formData.deadline ? { deadline: formData.deadline } : {}),
  }).select('id').single()

  if (error) return { error: error.message }
  await writeLog(supabase, userId, 'project_task', task.id, 'project_task.created', {
    title: formData.title.trim(),
    project_id: formData.project_id,
    stage_id: formData.stage_id,
    assignee_id: formData.assignee_id,
  })
  revalidatePath(`/dashboard/projects/${formData.project_id}`)
  return { error: null, id: task.id }
}

/** Переместить задачу в другой этап. Ставится в конец нового этапа. */
export async function moveProjectTask(taskId: string, newStageId: string, projectId: string) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  // В новый этап — в конец списка
  const nextOrder = await nextOrderIndex(supabase, newStageId)

  const { error } = await supabase
    .from('project_tasks')
    .update({ stage_id: newStageId, order_index: nextOrder })
    .eq('id', taskId)
  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'project_task', taskId, 'project_task.moved', {
    new_stage_id: newStageId,
  })
  revalidatePath(`/dashboard/projects/${projectId}`)
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

  // Параллельные UPDATE — для 10-30 задач это копейки.
  // RPC через SQL был бы атомарнее, но текущая нагрузка не оправдывает.
  await Promise.all(
    orderedIds.map((id, idx) =>
      supabase
        .from('project_tasks')
        .update({ order_index: idx + 1 })
        .eq('id', id)
        .eq('stage_id', stageId),
    ),
  )

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { error: null }
}

export async function updateProjectTaskStatus(taskId: string, status: string, projectId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error, warning: null }
  const { supabase, userId } = auth

  const { data: taskInfo } = await supabase
    .from('project_tasks')
    .select('title, assignee_id')
    .eq('id', taskId)
    .single()

  const { error } = await supabase.from('project_tasks').update({ status }).eq('id', taskId)
  if (error) return { error: error.message, warning: null }

  await writeLog(supabase, userId, 'project_task', taskId, 'project_task.status_changed', {
    status,
    title: taskInfo?.title,
  })

  // WIP-check после успешного обновления — мягкий warning, не блокирует.
  let warning: string | null = null
  if (status === 'in_progress' && taskInfo?.assignee_id) {
    const { getUserWip } = await import('@/lib/wip')
    const wip = await getUserWip(supabase, taskInfo.assignee_id)
    if (wip.state === 'over') {
      warning = `WIP-лимит превышен: в работе ${wip.active} из ${wip.limit}. Заверши одно из текущих.`
    }
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/tasks')
  return { error: null, warning }
}

export async function submitProjectTaskFeedback(taskId: string, note: string, status: string, projectId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const { data: taskInfo } = await supabase.from('project_tasks').select('title').eq('id', taskId).single()
  const { error } = await supabase.from('project_tasks').update({
    employee_note: note.trim() || null,
    status,
  }).eq('id', taskId)
  if (error) return { error: error.message }
  await writeLog(supabase, userId, 'project_task', taskId, 'project_task.feedback', {
    status,
    title: taskInfo?.title,
    note: note.trim() || null,
  })
  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/tasks')
  return { error: null }
}

export async function deleteProjectTask(taskId: string, projectId: string) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const { data: taskInfo } = await supabase.from('project_tasks').select('title').eq('id', taskId).single()
  const { error } = await supabase.from('project_tasks').delete().eq('id', taskId)
  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'project_task', taskId, 'project_task.deleted', {
    title: taskInfo?.title ?? null,
  })
  revalidatePath(`/dashboard/projects/${projectId}`)
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
