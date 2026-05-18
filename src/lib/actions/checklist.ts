'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, requireManager } from '@/lib/auth'
import { writeLog } from '@/lib/actions/log'

export async function addChecklistItem(
  stageId: string,
  label: string,
  projectId: string,
) {
  // INSERT в RLS закрыт для всех кроме director/manager (миграция 022)
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const { data: existing } = await supabase
    .from('stage_checklist_items')
    .select('order_index')
    .eq('stage_id', stageId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextIndex = (existing?.[0]?.order_index ?? -1) + 1
  const trimmed = label.trim()

  const { data, error } = await supabase
    .from('stage_checklist_items')
    .insert({ stage_id: stageId, label: trimmed, is_required: false, order_index: nextIndex })
    .select()
    .single()

  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'stage', stageId, 'stage.checklist_item_added', {
    item_id: data.id,
    label: trimmed,
    project_id: projectId,
  })

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true, item: data }
}

export async function deleteChecklistItem(
  itemId: string,
  projectId: string,
) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const { data: item } = await supabase
    .from('stage_checklist_items')
    .select('stage_id, label')
    .eq('id', itemId)
    .single()

  const { error } = await supabase
    .from('stage_checklist_items')
    .delete()
    .eq('id', itemId)

  if (error) return { error: error.message }

  if (item?.stage_id) {
    await writeLog(supabase, userId, 'stage', item.stage_id, 'stage.checklist_item_removed', {
      item_id: itemId,
      label: item.label,
      project_id: projectId,
    })
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function toggleChecklistItem(
  itemId: string,
  isCompleted: boolean,
  projectId: string,
) {
  // UPDATE: разрешено также assignee этапа и менеджеру проекта (миграция 022 RLS).
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  // Перед изменением забираем текущее состояние — нужно имя предыдущего
  // отмечающего, чтобы в журнале «Прогресс» было видно, чью отметку сняли.
  type CheckerJoin = { full_name: string } | { full_name: string }[] | null
  const { data: before } = await supabase
    .from('stage_checklist_items')
    .select('stage_id, label, completed_by, completed_at, checker:profiles!completed_by(full_name)')
    .eq('id', itemId)
    .single<{ stage_id: string; label: string; completed_by: string | null; completed_at: string | null; checker: CheckerJoin }>()

  const update = isCompleted
    ? { is_completed: true, completed_by: userId, completed_at: new Date().toISOString() }
    : { is_completed: false, completed_by: null, completed_at: null }

  const { error } = await supabase
    .from('stage_checklist_items')
    .update(update)
    .eq('id', itemId)

  if (error) return { error: error.message }

  if (!before?.stage_id) {
    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true }
  }

  // Имя проверяющего может приехать массивом или объектом (зависит от FK Supabase).
  const checkerName = Array.isArray(before.checker)
    ? before.checker[0]?.full_name ?? null
    : before.checker?.full_name ?? null

  if (isCompleted) {
    await writeLog(supabase, userId, 'stage', before.stage_id, 'stage.checklist_item_completed', {
      item_id: itemId,
      label: before.label,
      project_id: projectId,
    })
  } else {
    // Снятие отметки — фиксируем кто и кого «откатил», чтобы директор мог
    // понять, что произошло, и нужный человек переотметил при необходимости.
    await writeLog(supabase, userId, 'stage', before.stage_id, 'stage.checklist_item_uncompleted', {
      item_id: itemId,
      label: before.label,
      project_id: projectId,
      previous_completed_by: before.completed_by,
      previous_completed_by_name: checkerName,
      previous_completed_at: before.completed_at,
    })
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}
