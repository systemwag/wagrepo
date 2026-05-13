'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireDirector } from '@/lib/auth'
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

export async function deleteTask(taskId: string, projectId: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const { error: dbError } = await auth.supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}
