'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, requireManager } from '@/lib/auth'
import { writeLog } from '@/lib/actions/log'
import {
  checklistItemAssigneesSchema,
  checklistItemDeadlineSchema,
  checklistItemAcceptSchema,
} from '@/lib/validation/checklist'

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

export async function updateChecklistItem(
  itemId: string,
  label: string,
  projectId: string,
) {
  // UPDATE label закрыт для всех кроме director/manager (миграция 022).
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const trimmed = label.trim()
  if (!trimmed) return { error: 'Название пункта не может быть пустым' }

  const { data: before } = await supabase
    .from('stage_checklist_items')
    .select('stage_id, label')
    .eq('id', itemId)
    .single()

  const { error } = await supabase
    .from('stage_checklist_items')
    .update({ label: trimmed })
    .eq('id', itemId)

  if (error) return { error: error.message }

  if (before?.stage_id) {
    await writeLog(supabase, userId, 'stage', before.stage_id, 'stage.checklist_item_renamed', {
      item_id: itemId,
      label: trimmed,
      previous_label: before.label,
      project_id: projectId,
    })
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
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
    .select('stage_id, label, completed_by, completed_at, started_at, checker:profiles!completed_by(full_name)')
    .eq('id', itemId)
    .single<{ stage_id: string; label: string; completed_by: string | null; completed_at: string | null; started_at: string | null; checker: CheckerJoin }>()

  // При completion закрываем «дыру» в timeline: если пункт никогда не был
  // принят в работу (started_at NULL) — заполняем его сейчас тем же таймстампом.
  // Менеджерский «шорткат»: отметил → автоматически считаем, что и принял.
  const now = new Date().toISOString()
  type ChecklistUpdate = {
    is_completed: boolean
    completed_by: string | null
    completed_at: string | null
    started_at?: string
    started_by?: string
  }
  const update: ChecklistUpdate = isCompleted
    ? { is_completed: true, completed_by: userId, completed_at: now }
    : { is_completed: false, completed_by: null, completed_at: null }

  if (isCompleted && !before?.started_at) {
    update.started_at = now
    update.started_by = userId
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// Миграция 065: ответственные за пункт чек-листа, дедлайн, accept в работу.
// Право управления (назначать, ставить дедлайн) проверяется RLS:
//   stage_checklist_item_assignees.INSERT/DELETE — через can_manage_stage_checklist
//   stage_checklist_items.UPDATE — через can_manage_stage_checklist ИЛИ assignee пункта
// Здесь в коде дополнительных проверок нет — доверяем RLS.
// ─────────────────────────────────────────────────────────────────────────────

/** Переопределить ответственных за пункт чек-листа (diff add/remove). */
export async function setChecklistItemAssignees(input: {
  itemId: string
  projectId: string
  profileIds: string[]
}) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = checklistItemAssigneesSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const { itemId, projectId, profileIds } = parsed.data

  const { data: itemMeta } = await supabase
    .from('stage_checklist_items')
    .select('stage_id, label')
    .eq('id', itemId)
    .single()

  if (!itemMeta) return { error: 'Пункт не найден' }

  const { data: existingRows } = await supabase
    .from('stage_checklist_item_assignees')
    .select('profile_id')
    .eq('item_id', itemId)

  const existingIds = new Set((existingRows ?? []).map(r => r.profile_id as string))
  const newIds      = new Set(profileIds.filter(Boolean))

  const toRemove = [...existingIds].filter(id => !newIds.has(id))
  const toAdd    = [...newIds].filter(id => !existingIds.has(id))

  // Имена — для лога. Если у людей нет full_name — будут id.
  let nameById = new Map<string, string>()
  const lookupIds = [...toRemove, ...toAdd]
  if (lookupIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', lookupIds)
    nameById = new Map((profs ?? []).map(p => [p.id as string, p.full_name as string]))
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('stage_checklist_item_assignees')
      .delete()
      .eq('item_id', itemId)
      .in('profile_id', toRemove)
    if (error) return { error: error.message }
  }
  if (toAdd.length > 0) {
    const rows = toAdd.map(profile_id => ({ item_id: itemId, profile_id }))
    const { error } = await supabase
      .from('stage_checklist_item_assignees')
      .insert(rows)
    if (error) return { error: error.message }
  }

  // Один лог-event на всю операцию — не засорять журнал.
  if (toAdd.length > 0 || toRemove.length > 0) {
    await writeLog(supabase, userId, 'stage', itemMeta.stage_id, 'stage.checklist_item_assignees_changed', {
      item_id: itemId,
      label: itemMeta.label,
      project_id: projectId,
      added:   toAdd.map(id    => ({ id, name: nameById.get(id) ?? null })),
      removed: toRemove.map(id => ({ id, name: nameById.get(id) ?? null })),
    })
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { error: null }
}

/** Установить или снять дедлайн пункта (deadline=null — снять). */
export async function setChecklistItemDeadline(input: {
  itemId: string
  projectId: string
  deadline: string | null
}) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = checklistItemDeadlineSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const { itemId, projectId, deadline } = parsed.data

  const { data: before } = await supabase
    .from('stage_checklist_items')
    .select('stage_id, label, deadline')
    .eq('id', itemId)
    .single()

  if (!before) return { error: 'Пункт не найден' }

  const { error } = await supabase
    .from('stage_checklist_items')
    .update({ deadline })
    .eq('id', itemId)

  if (error) return { error: error.message }

  const action = deadline === null
    ? 'stage.checklist_item_deadline_cleared'
    : 'stage.checklist_item_deadline_set'

  await writeLog(supabase, userId, 'stage', before.stage_id, action, {
    item_id: itemId,
    label: before.label,
    project_id: projectId,
    deadline,
    previous_deadline: before.deadline,
  })

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { error: null }
}

/** Взять пункт «в работу» — заполнить started_at/started_by, если ещё не. */
export async function acceptChecklistItem(input: { itemId: string; projectId: string }) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = checklistItemAcceptSchema.safeParse(input)
  if (!parsed.success) return { error: 'Некорректные данные' }
  const { itemId, projectId } = parsed.data

  const { data: before } = await supabase
    .from('stage_checklist_items')
    .select('stage_id, label, started_at, is_completed')
    .eq('id', itemId)
    .single()

  if (!before) return { error: 'Пункт не найден' }
  // Идемпотентность: уже взято в работу или уже сдано — no-op.
  if (before.started_at || before.is_completed) return { error: null }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('stage_checklist_items')
    .update({ started_at: now, started_by: userId })
    .eq('id', itemId)
    .is('started_at', null)            // защита от гонок

  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'stage', before.stage_id, 'stage.checklist_item_started', {
    item_id: itemId,
    label: before.label,
    project_id: projectId,
  })

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { error: null }
}
