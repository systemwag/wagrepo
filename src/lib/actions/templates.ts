'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, requireDirector } from '@/lib/auth'

export type ProjectTemplate = {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  is_default: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export type TemplateStage = {
  id: string
  template_id: string
  name: string
  stage_key: string | null
  order_index: number
}

export type TemplateChecklistItem = {
  id: string
  template_stage_id: string
  label: string
  order_index: number
  is_required: boolean
}

export type TemplateWithStages = ProjectTemplate & {
  stages: (TemplateStage & { checklist: TemplateChecklistItem[] })[]
}

// ─── Read ───────────────────────────────────────────────────────────────────

/** Список активных (не архивных) шаблонов. Все аутентифицированные читают. */
export async function fetchTemplates(): Promise<ProjectTemplate[]> {
  const auth = await requireAuth()
  if (!auth.ok) return []

  const { data } = await auth.supabase
    .from('project_templates')
    .select('*')
    .eq('is_archived', false)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  return data ?? []
}

/** Один шаблон вместе со всеми этапами и пунктами чек-листа. */
export async function fetchTemplate(id: string): Promise<TemplateWithStages | null> {
  const auth = await requireAuth()
  if (!auth.ok) return null

  const [{ data: template }, { data: stages }] = await Promise.all([
    auth.supabase
      .from('project_templates')
      .select('*')
      .eq('id', id)
      .single(),
    auth.supabase
      .from('template_stages')
      .select('*, checklist:template_checklist_items(*)')
      .eq('template_id', id)
      .order('order_index', { ascending: true }),
  ])

  if (!template) return null

  const normalizedStages = (stages ?? []).map(s => ({
    ...s,
    checklist: Array.isArray(s.checklist)
      ? (s.checklist as TemplateChecklistItem[]).sort((a, b) => a.order_index - b.order_index)
      : [],
  }))

  return { ...(template as ProjectTemplate), stages: normalizedStages }
}

// ─── Mutations (только admin/director) ───────────────────────────────────────

export async function createTemplate(input: {
  name: string
  description?: string | null
  icon?: string | null
  color?: string | null
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const auth = await requireDirector()
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Нет прав' }

  const { data, error } = await auth.supabase
    .from('project_templates')
    .insert({
      name:        input.name.trim(),
      description: input.description?.trim() || null,
      icon:        input.icon ?? 'compass',
      color:       input.color ?? '#22c55e',
      created_by:  auth.userId,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'Не удалось создать' }

  revalidatePath('/dashboard/settings/templates')
  return { ok: true, id: data.id }
}

export async function updateTemplate(
  id: string,
  patch: Partial<{
    name: string
    description: string | null
    icon: string | null
    color: string | null
    is_archived: boolean
    is_default: boolean
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDirector()
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Нет прав' }

  // Если выставляется is_default = TRUE — сначала снимаем флаг с остальных,
  // чтобы partial unique index не упал.
  if (patch.is_default === true) {
    await auth.supabase
      .from('project_templates')
      .update({ is_default: false })
      .eq('is_default', true)
      .neq('id', id)
  }

  const { error } = await auth.supabase
    .from('project_templates')
    .update(patch)
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/settings/templates')
  revalidatePath(`/dashboard/settings/templates/${id}`)
  return { ok: true }
}

export async function deleteTemplate(id: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDirector()
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Нет прав' }

  // Проверяем что шаблон не используется. Удаление шаблона у проекта не каскадирует
  // (template_id ON DELETE SET NULL) — данные не пропадут, но шаблон исчезнет
  // из истории. Лучше предупредить пользователя.
  const { count } = await auth.supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Шаблон используется в ${count} проекте(ах). Сначала переведите их на другой шаблон или заархивируйте этот.`,
    }
  }

  const { error } = await auth.supabase
    .from('project_templates')
    .delete()
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/settings/templates')
  return { ok: true }
}

// ─── Stages ────────────────────────────────────────────────────────────────

export async function addTemplateStage(
  templateId: string,
  input: { name: string; stage_key?: string | null },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const auth = await requireDirector()
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Нет прав' }

  const { data: existing } = await auth.supabase
    .from('template_stages')
    .select('order_index')
    .eq('template_id', templateId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextIdx = ((existing?.order_index as number | undefined) ?? 0) + 1

  const { data, error } = await auth.supabase
    .from('template_stages')
    .insert({
      template_id: templateId,
      name:        input.name.trim(),
      stage_key:   input.stage_key ?? null,
      order_index: nextIdx,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'Не удалось создать' }
  revalidatePath(`/dashboard/settings/templates/${templateId}`)
  return { ok: true, id: data.id }
}

export async function updateTemplateStage(
  id: string,
  templateId: string,
  patch: Partial<{ name: string; stage_key: string | null; order_index: number }>,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDirector()
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Нет прав' }

  const { error } = await auth.supabase
    .from('template_stages')
    .update(patch)
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/dashboard/settings/templates/${templateId}`)
  return { ok: true }
}

export async function deleteTemplateStage(
  id: string,
  templateId: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDirector()
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Нет прав' }

  const { error } = await auth.supabase
    .from('template_stages')
    .delete()
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/dashboard/settings/templates/${templateId}`)
  return { ok: true }
}

/** Изменить порядок этапов целиком — принимает массив id в нужной последовательности. */
export async function reorderTemplateStages(
  templateId: string,
  orderedIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDirector()
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Нет прав' }

  await Promise.all(
    orderedIds.map((id, idx) =>
      auth.supabase
        .from('template_stages')
        .update({ order_index: idx + 1 })
        .eq('id', id),
    ),
  )

  revalidatePath(`/dashboard/settings/templates/${templateId}`)
  return { ok: true }
}

// ─── Checklist items ───────────────────────────────────────────────────────

export async function addTemplateChecklistItem(
  templateStageId: string,
  templateId: string,
  label: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDirector()
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Нет прав' }

  const { data: existing } = await auth.supabase
    .from('template_checklist_items')
    .select('order_index')
    .eq('template_stage_id', templateStageId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextIdx = ((existing?.order_index as number | undefined) ?? 0) + 1

  const { error } = await auth.supabase
    .from('template_checklist_items')
    .insert({
      template_stage_id: templateStageId,
      label:             label.trim(),
      order_index:       nextIdx,
    })

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/dashboard/settings/templates/${templateId}`)
  return { ok: true }
}

export async function updateTemplateChecklistItem(
  id: string,
  templateId: string,
  patch: Partial<{ label: string; is_required: boolean; order_index: number }>,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDirector()
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Нет прав' }

  const { error } = await auth.supabase
    .from('template_checklist_items')
    .update(patch)
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/dashboard/settings/templates/${templateId}`)
  return { ok: true }
}

export async function deleteTemplateChecklistItem(
  id: string,
  templateId: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDirector()
  if (!auth.ok) return { ok: false, error: auth.error ?? 'Нет прав' }

  const { error } = await auth.supabase
    .from('template_checklist_items')
    .delete()
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/dashboard/settings/templates/${templateId}`)
  return { ok: true }
}
