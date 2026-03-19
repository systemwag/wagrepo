'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireDirector() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' as const, supabase: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'director') return { error: 'Нет прав' as const, supabase: null }
  return { error: null, supabase }
}

export async function deleteProject(projectId: string) {
  const { error, supabase } = await requireDirector()
  if (error) return { error }

  // Удаляем файлы из Storage для всех документов проекта
  const { data: docs } = await supabase!
    .from('documents')
    .select('file_path')
    .eq('project_id', projectId)

  if (docs && docs.length > 0) {
    await supabase!.storage
      .from('project-files')
      .remove(docs.map(d => d.file_path))
  }

  const { error: dbError } = await supabase!
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (dbError) return { error: dbError.message }

  revalidatePath('/dashboard/projects')
  redirect('/dashboard/projects')
}

export async function deleteStage(stageId: string, projectId: string) {
  const { error, supabase } = await requireDirector()
  if (error) return { error }

  // Удаляем файлы из Storage
  const { data: docs } = await supabase!
    .from('documents')
    .select('file_path')
    .eq('stage_id', stageId)

  if (docs && docs.length > 0) {
    await supabase!.storage
      .from('project-files')
      .remove(docs.map(d => d.file_path))
  }

  const { error: dbError } = await supabase!
    .from('project_stages')
    .delete()
    .eq('id', stageId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function deleteTask(taskId: string, projectId: string) {
  const { error, supabase } = await requireDirector()
  if (error) return { error }

  const { error: dbError } = await supabase!
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}
