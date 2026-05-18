'use server'

import { revalidatePath } from 'next/cache'
import { requireManager } from '@/lib/auth'

// ─────────────────────────────────────────────────────────────────────────────
// Управление множественными исполнителями для:
//   - project_stages   (junction: project_stage_assignees)
//   - project_tasks    (junction: project_task_assignees)
//   - direct_tasks     (junction: direct_task_assignees)
//
// Идея: вызывающий передаёт **полный** новый список исполнителей.
// Сервер вычисляет diff (кого добавить / кого убрать), чтобы:
//   - notification-триггеры срабатывали ТОЛЬКО на реально новых (без дублей)
//   - не было лишней нагрузки на БД при «нет изменений»
// ─────────────────────────────────────────────────────────────────────────────

/** Переопределить ответственных за этап проекта. */
export async function setStageAssignees(
  stageId: string,
  profileIds: string[],
  projectId: string,
) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth

  const { data: existing } = await supabase
    .from('project_stage_assignees')
    .select('profile_id')
    .eq('stage_id', stageId)

  const existingIds = new Set((existing ?? []).map(r => r.profile_id as string))
  const newIds = new Set(profileIds.filter(Boolean))

  const toRemove = [...existingIds].filter(id => !newIds.has(id))
  const toAdd    = [...newIds].filter(id => !existingIds.has(id))

  if (toRemove.length > 0) {
    await supabase
      .from('project_stage_assignees')
      .delete()
      .eq('stage_id', stageId)
      .in('profile_id', toRemove)
  }
  if (toAdd.length > 0) {
    await supabase
      .from('project_stage_assignees')
      .insert(toAdd.map(profile_id => ({ stage_id: stageId, profile_id })))
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { error: null }
}

/** Переопределить исполнителей задачи в проекте. */
export async function setProjectTaskAssignees(
  taskId: string,
  profileIds: string[],
  projectId: string,
) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth

  const { data: existing } = await supabase
    .from('project_task_assignees')
    .select('profile_id')
    .eq('task_id', taskId)

  const existingIds = new Set((existing ?? []).map(r => r.profile_id as string))
  const newIds = new Set(profileIds.filter(Boolean))

  const toRemove = [...existingIds].filter(id => !newIds.has(id))
  const toAdd    = [...newIds].filter(id => !existingIds.has(id))

  if (toRemove.length > 0) {
    await supabase
      .from('project_task_assignees')
      .delete()
      .eq('task_id', taskId)
      .in('profile_id', toRemove)
  }
  if (toAdd.length > 0) {
    await supabase
      .from('project_task_assignees')
      .insert(toAdd.map(profile_id => ({ task_id: taskId, profile_id })))
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/tasks')
  return { error: null }
}

/** Переопределить исполнителей прямого поручения. */
export async function setDirectTaskAssignees(taskId: string, profileIds: string[]) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth

  const { data: existing } = await supabase
    .from('direct_task_assignees')
    .select('profile_id')
    .eq('task_id', taskId)

  const existingIds = new Set((existing ?? []).map(r => r.profile_id as string))
  const newIds = new Set(profileIds.filter(Boolean))

  const toRemove = [...existingIds].filter(id => !newIds.has(id))
  const toAdd    = [...newIds].filter(id => !existingIds.has(id))

  if (toRemove.length > 0) {
    await supabase
      .from('direct_task_assignees')
      .delete()
      .eq('task_id', taskId)
      .in('profile_id', toRemove)
  }
  if (toAdd.length > 0) {
    await supabase
      .from('direct_task_assignees')
      .insert(toAdd.map(profile_id => ({ task_id: taskId, profile_id })))
  }

  revalidatePath('/dashboard/assignments')
  revalidatePath('/dashboard/assign')
  return { error: null }
}
