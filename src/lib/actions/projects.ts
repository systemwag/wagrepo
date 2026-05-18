'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireDirector, requireManager } from '@/lib/auth'
import { writeLog } from '@/lib/actions/log'

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
 * Переместить проект в другой этап (на канбане проектов /dashboard/projects/board).
 * Меняется только projects.current_stage_id — статусы конкретных этапов
 * (project_stages.status) остаются на совести менеджера и обновляются вручную.
 */
export async function moveProjectToStage(projectId: string, newStageId: string | null) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const { error } = await supabase
    .from('projects')
    .update({ current_stage_id: newStageId })
    .eq('id', projectId)

  if (error) return { error: error.message }

  // Подтягиваем имя этапа, чтобы в логе показывать «переместил на этап «Геология»»,
  // а не голый id. Для newStageId=null (сняли этап) — пишем без имени.
  let stageName: string | null = null
  let stageKey: string | null = null
  if (newStageId) {
    const { data: st } = await supabase
      .from('project_stages')
      .select('name, stage_key')
      .eq('id', newStageId)
      .maybeSingle()
    stageName = (st as { name?: string } | null)?.name ?? null
    stageKey  = (st as { stage_key?: string } | null)?.stage_key ?? null
  }

  await writeLog(supabase, userId, 'project', projectId, 'project.stage_moved', {
    new_stage_id: newStageId,
    stage_name:   stageName,
    stage_key:    stageKey,
  })

  revalidatePath('/dashboard/projects/board')
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { error: null }
}

/**
 * Тот же moveProjectToStage, но принимает stage_key вместо id —
 * сервер сам найдёт соответствующий project_stage у этого проекта.
 * Используется DnD на канбане проектов, где колонки — общие по stage_key.
 */
export async function moveProjectToStageByKey(projectId: string, stageKey: string) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const { data: stage, error: stageError } = await supabase
    .from('project_stages')
    .select('id, name')
    .eq('project_id', projectId)
    .eq('stage_key', stageKey)
    .maybeSingle()

  if (stageError) return { error: stageError.message }
  if (!stage) return { error: `У проекта нет этапа «${stageKey}»` }

  const { error } = await supabase
    .from('projects')
    .update({ current_stage_id: stage.id })
    .eq('id', projectId)

  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'project', projectId, 'project.stage_moved', {
    new_stage_id: stage.id,
    stage_name:   (stage as { name?: string }).name ?? null,
    stage_key:    stageKey,
  })

  revalidatePath('/dashboard/projects/board')
  return { error: null }
}
