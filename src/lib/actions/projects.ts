'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireDirector, requireManager } from '@/lib/auth'
import { writeLog } from '@/lib/actions/log'
import { setFlashToast } from '@/lib/toast'
import { projectUpdateSchema, type ProjectUpdateInput } from '@/lib/validation/projects'

export async function deleteProject(projectId: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  // Достаём имя до удаления — для лога активности.
  const { data: projectInfo } = await supabase
    .from('projects').select('name').eq('id', projectId).single()

  const { data: docs } = await supabase
    .from('documents')
    .select('file_path')
    .eq('project_id', projectId)

  if (docs && docs.length > 0) {
    await supabase.storage
      .from('project-files')
      .remove(docs.map(d => d.file_path))
  }

  const { error: dbError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (dbError) return { error: dbError.message }

  await writeLog(supabase, userId, 'project', projectId, 'project.deleted', {
    name: projectInfo?.name ?? null,
  })
  await setFlashToast('success', projectInfo?.name
    ? `Проект «${projectInfo.name}» удалён`
    : 'Проект удалён')
  revalidatePath('/dashboard/projects')
  redirect('/dashboard/projects')
}

export async function deleteStage(stageId: string, projectId: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth

  const { data: docs } = await supabase
    .from('documents')
    .select('file_path')
    .eq('stage_id', stageId)

  if (docs && docs.length > 0) {
    await supabase.storage
      .from('project-files')
      .remove(docs.map(d => d.file_path))
  }

  const { error: dbError } = await supabase
    .from('project_stages')
    .delete()
    .eq('id', stageId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

// deleteTask перенесён в src/lib/actions/project-tasks.ts → deleteProjectTask

/**
 * Редактирование метаданных проекта (название/описание/даты/заказчик/договор/менеджер).
 * template_id не редактируется — этапы уже созданы из шаблона.
 * Доступно menager+ (RLS — дополнительный страж).
 */
export async function updateProject(input: ProjectUpdateInput) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = projectUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' }
  }
  const v = parsed.data

  const { error } = await supabase
    .from('projects')
    .update({
      name:            v.name,
      client_name:     v.client_name || null,
      contract_number: v.contract_number || null,
      start_date:      v.start_date ?? null,
      deadline:        v.deadline ?? null,
      description:     v.description?.trim() || null,
      manager_id:      v.manager_id,
    })
    .eq('id', v.id)

  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'project', v.id, 'project.updated', { name: v.name })

  revalidatePath(`/dashboard/projects/${v.id}`)
  revalidatePath('/dashboard/projects')
  return { error: null }
}
