'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { StageStatus, ReviewStatus } from '@/lib/constants/design-stages'
import { writeLog } from '@/lib/actions/log'

export async function updateStageStatus(
  stageId: string,
  status: StageStatus,
  projectId: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const update: Record<string, unknown> = { status }
  if (status === 'completed') {
    update.completed_at = new Date().toISOString()
  } else {
    update.completed_at = null
  }

  const { error } = await supabase
    .from('project_stages')
    .update(update)
    .eq('id', stageId)

  if (error) return { error: error.message }

  const [{ data: stageInfo }, { data: projectInfo }] = await Promise.all([
    supabase.from('project_stages').select('name').eq('id', stageId).single(),
    supabase.from('projects').select('name').eq('id', projectId).single(),
  ])

  await writeLog(supabase, user.id, 'stage', stageId, 'stage.status_changed', {
    status,
    projectId,
    stageName:   stageInfo?.name   ?? null,
    projectName: projectInfo?.name ?? null,
  })
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function updateStageNotes(
  stageId: string,
  notes: string,
  projectId: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase
    .from('project_stages')
    .update({ notes })
    .eq('id', stageId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function updateStageDeadline(
  stageId: string,
  deadline: string | null,
  projectId: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase
    .from('project_stages')
    .update({ deadline })
    .eq('id', stageId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function assignStageResponsible(
  stageId: string,
  assigneeId: string | null,
  projectId: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase
    .from('project_stages')
    .update({ assignee_id: assigneeId })
    .eq('id', stageId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function updateStageReview(
  stageId: string,
  reviewStatus: ReviewStatus | null,
  projectId: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const update = reviewStatus
    ? { review_status: reviewStatus, reviewed_by: user.id, reviewed_at: new Date().toISOString() }
    : { review_status: null, reviewed_by: null, reviewed_at: null }

  const { error } = await supabase
    .from('project_stages')
    .update(update)
    .eq('id', stageId)

  if (error) return { error: error.message }

  const [{ data: stageInfo }, { data: projectInfo }] = await Promise.all([
    supabase.from('project_stages').select('name').eq('id', stageId).single(),
    supabase.from('projects').select('name').eq('id', projectId).single(),
  ])

  await writeLog(supabase, user.id, 'stage', stageId, 'stage.review_changed', {
    review_status: reviewStatus,
    projectId,
    stageName:   stageInfo?.name   ?? null,
    projectName: projectInfo?.name ?? null,
  })
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

export async function deleteStageDocument(
  documentId: string,
  filePath: string,
  projectId: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  await supabase.storage.from('project-files').remove([filePath])

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}
