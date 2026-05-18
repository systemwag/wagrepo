'use server'

import { revalidatePath } from 'next/cache'
import type { StageStatus, ReviewStatus } from '@/lib/constants/design-stages'
import { MAX_DOCUMENT_BYTES, ALLOWED_MIME_PREFIXES } from '@/lib/constants/documents'
import { writeLog } from '@/lib/actions/log'
import { requireAuth } from '@/lib/auth'

export async function updateStageStatus(
  stageId: string,
  status: StageStatus,
  projectId: string,
) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

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

  await writeLog(supabase, userId, 'stage', stageId, 'stage.status_changed', {
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
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.supabase
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
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.supabase
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
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.supabase
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
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const update = reviewStatus
    ? { review_status: reviewStatus, reviewed_by: userId, reviewed_at: new Date().toISOString() }
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

  await writeLog(supabase, userId, 'stage', stageId, 'stage.review_changed', {
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
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  // Сначала забираем мета — нужны stage_id + name для лога.
  const { data: doc } = await supabase
    .from('documents')
    .select('stage_id, name')
    .eq('id', documentId)
    .single()

  await supabase.storage.from('project-files').remove([filePath])

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (error) return { error: error.message }

  if (doc?.stage_id) {
    await writeLog(supabase, userId, 'stage', doc.stage_id, 'stage.document_removed', {
      document_name: doc.name,
      project_id: projectId,
    })
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true }
}

/**
 * Записывает в БД факт прикрепления документа к этапу.
 * Файл уже загружен в storage клиентом — здесь только insert в documents +
 * запись в activity_log. RLS на documents.INSERT требует uploaded_by = auth.uid().
 */
export async function attachStageDocument(input: {
  stageId:    string
  projectId:  string
  name:       string
  filePath:   string
  fileSize:   number | null
  mimeType:   string | null
}) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  // Валидация размера — клиент уже проверял, но клиента можно патчить.
  if (input.fileSize !== null && input.fileSize > MAX_DOCUMENT_BYTES) {
    // Чистим storage от уже загруженного файла, иначе останется orphan.
    await supabase.storage.from('project-files').remove([input.filePath])
    return { error: `Файл слишком большой (лимит ${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} МБ)` }
  }

  // Валидация типа — соответствует accept на клиенте (.pdf,.jpg,.jpeg,.png).
  if (input.mimeType && !ALLOWED_MIME_PREFIXES.some(p => input.mimeType!.startsWith(p))) {
    await supabase.storage.from('project-files').remove([input.filePath])
    return { error: 'Допустимы только PDF и изображения' }
  }

  // Проверяем, что stage действительно принадлежит указанному проекту —
  // чтобы клиент не подсунул чужой stage_id с правильным project_id.
  const { data: stage } = await supabase
    .from('project_stages')
    .select('id, project_id')
    .eq('id', input.stageId)
    .single()

  if (!stage || stage.project_id !== input.projectId) {
    await supabase.storage.from('project-files').remove([input.filePath])
    return { error: 'Этап не найден или принадлежит другому проекту' }
  }

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      project_id:  input.projectId,
      stage_id:    input.stageId,
      name:        input.name.trim() || 'Без названия',
      file_path:   input.filePath,
      file_size:   input.fileSize,
      mime_type:   input.mimeType,
      uploaded_by: userId,
    })
    .select('id, name, file_path, file_size, mime_type, created_at')
    .single()

  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'stage', input.stageId, 'stage.document_attached', {
    document_id: doc.id,
    document_name: doc.name,
    project_id: input.projectId,
  })

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return { success: true, doc }
}
