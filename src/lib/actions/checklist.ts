'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addChecklistItem(
  stageId: string,
  label: string,
  projectId: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  // Определяем следующий order_index
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const update = isCompleted
    ? { is_completed: true, completed_by: user.id, completed_at: new Date().toISOString() }
    : { is_completed: false, completed_by: null, completed_at: null }

  const { error } = await supabase
    .from('stage_checklist_items')
    .update(update)
    .eq('id', itemId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}
