'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, requireManager } from '@/lib/auth'

export async function addChecklistItem(
  stageId: string,
  label: string,
  projectId: string,
) {
  // INSERT в RLS закрыт для всех кроме director/manager (миграция 022)
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth

  const { data: existing } = await supabase
    .from('stage_checklist_items')
    .select('order_index')
    .eq('stage_id', stageId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextIndex = (existing?.[0]?.order_index ?? -1) + 1

  const { data, error } = await supabase
    .from('stage_checklist_items')
    .insert({ stage_id: stageId, label: label.trim(), is_required: false, order_index: nextIndex })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true, item: data }
}

export async function deleteChecklistItem(
  itemId: string,
  projectId: string,
) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.supabase
    .from('stage_checklist_items')
    .delete()
    .eq('id', itemId)

  if (error) return { error: error.message }

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

  const update = isCompleted
    ? { is_completed: true, completed_by: userId, completed_at: new Date().toISOString() }
    : { is_completed: false, completed_by: null, completed_at: null }

  const { error } = await supabase
    .from('stage_checklist_items')
    .update(update)
    .eq('id', itemId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}
