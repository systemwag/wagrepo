'use server'

import { revalidatePath } from 'next/cache'
import { writeLog } from '@/lib/actions/log'
import { requireAuth, requireManager } from '@/lib/auth'
import {
  createDirectTaskBulkSchema,
  createDirectTaskSchema,
  deleteDirectTaskSchema,
  submitDirectTaskFeedbackSchema,
  updateDirectTaskBatchSchema,
  updateDirectTaskSchema,
  updateDirectTaskStatusSchema,
} from '@/lib/validation/direct-tasks'

// ─────────────────────────────────────────────────────────────────────────────
// Прямые поручения (direct_tasks)
// Создают директор и менеджер (миграция 047). Получатель — любой пользователь.
// Связи с проектом нет: это «купи кофе, принеси договор» уровень.
// Удалять может автор (своё) или директор+ (любое) — RLS из 047.
// ─────────────────────────────────────────────────────────────────────────────

export async function createDirectTask(formData: {
  title: string
  description: string
  assignee_id: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  deadline: string | null
}) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = createDirectTaskSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  const { data: task, error } = await supabase.from('direct_tasks').insert({
    title: input.title,
    description: input.description.trim() || null,
    assignee_id: input.assignee_id,
    priority: input.priority,
    created_by: userId,
    status: 'todo',
    ...(input.deadline ? { deadline: input.deadline } : {}),
  }).select('id').single()

  if (error) return { error: error.message }
  await writeLog(supabase, userId, 'direct_task', task.id, 'direct_task.created', {
    title: input.title,
    assignee_id: input.assignee_id,
    priority: input.priority,
  })
  revalidatePath('/dashboard/assign')
  return { error: null }
}

export async function createDirectTaskBulk(formData: {
  title: string
  description: string
  assignee_ids: string[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  deadline: string | null
}) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = createDirectTaskBulkSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  // Несколько исполнителей одной выдачи помечаем общим batch_id, чтобы журнал
  // схлопывал их в одну карточку. Одиночное поручение оставляем без batch_id.
  const batchId = input.assignee_ids.length > 1 ? crypto.randomUUID() : null

  const rows = input.assignee_ids.map(assignee_id => ({
    title: input.title,
    description: input.description.trim() || null,
    assignee_id,
    priority: input.priority,
    created_by: userId,
    status: 'todo',
    ...(batchId ? { batch_id: batchId } : {}),
    ...(input.deadline ? { deadline: input.deadline } : {}),
  }))

  const { data: tasks, error } = await supabase.from('direct_tasks').insert(rows).select('id')
  if (error) return { error: error.message }

  if (tasks && tasks.length > 0) {
    const logRows = tasks.map((task, i) => ({
      actor_id: userId,
      entity_type: 'direct_task' as const,
      entity_id: task.id,
      action: 'direct_task.created',
      meta: {
        title: input.title,
        assignee_id: input.assignee_ids[i],
        priority: input.priority,
      },
    }))
    try {
      await supabase.from('activity_log').insert(logRows)
    } catch {
      // лог не должен ломать основную операцию
    }
  }
  revalidatePath('/dashboard/assign')
  return { error: null }
}

export async function updateDirectTask(taskId: string, data: {
  title: string
  description: string
  assignee_id: string
  priority: string
  deadline: string | null
}) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const idParsed = deleteDirectTaskSchema.safeParse(taskId)
  if (!idParsed.success) return { error: 'Некорректный идентификатор поручения' }

  const parsed = updateDirectTaskSchema.safeParse(data)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  const { error } = await supabase.from('direct_tasks').update({
    title: input.title,
    description: input.description.trim() || null,
    assignee_id: input.assignee_id,
    priority: input.priority,
    deadline: input.deadline || null,
  }).eq('id', idParsed.data)
  if (error) return { error: error.message }
  await writeLog(supabase, userId, 'direct_task', idParsed.data, 'direct_task.updated', { title: input.title })
  revalidatePath('/dashboard/assign')
  return { error: null }
}

/**
 * Групповое редактирование пачки поручений (batch_id): общие поля
 * (название/описание/приоритет/срок) меняются сразу у всех исполнителей.
 * Исполнители пачки не трогаются — их меняют поштучно через updateDirectTask.
 * RLS сам ограничивает обновление строками, доступными вызывающему.
 */
export async function updateDirectTaskBatch(batchId: string, data: {
  title: string
  description: string
  priority: string
  deadline: string | null
}) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = updateDirectTaskBatchSchema.safeParse({ batchId, ...data })
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  const { error } = await supabase.from('direct_tasks').update({
    title: input.title,
    description: input.description.trim() || null,
    priority: input.priority,
    deadline: input.deadline || null,
  }).eq('batch_id', input.batchId)
  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'direct_task', input.batchId, 'direct_task.updated', {
    title: input.title,
    batch: true,
  })
  revalidatePath('/dashboard/assign')
  return { error: null }
}

export async function deleteDirectTask(taskId: string) {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = deleteDirectTaskSchema.safeParse(taskId)
  if (!parsed.success) return { error: 'Некорректный идентификатор поручения' }
  const id = parsed.data

  // Достаём title до удаления, чтобы лог содержал контекст.
  const { data: taskInfo } = await supabase.from('direct_tasks').select('title').eq('id', id).single()
  const { error } = await supabase.from('direct_tasks').delete().eq('id', id)
  if (error) return { error: error.message }
  await writeLog(supabase, userId, 'direct_task', id, 'direct_task.deleted', { title: taskInfo?.title ?? null })
  revalidatePath('/dashboard/assign')
  return { error: null }
}

/**
 * Сотрудник помечает поручение как «Не завершено» с обязательной причиной.
 * Зеркалит markProjectTaskFailed для project_tasks: исполнитель остаётся,
 * статус становится 'failed', причина — в employee_note. Директор увидит
 * провал и сам решит, возвращать в работу или нет.
 */
export async function markDirectTaskFailed(taskId: string, reason: string) {
  const trimmed = reason.trim()
  if (!trimmed) return { error: 'Укажите причину' }
  return submitDirectTaskFeedback(taskId, trimmed, 'failed')
}

/**
 * Смена статуса поручения. Допустимо для исполнителя и создателя.
 * При переходе в `in_progress` проверяет WIP-лимит у assignee и возвращает
 * мягкое предупреждение (не блокирует — UI решает что показать).
 */
export async function updateDirectTaskStatus(taskId: string, status: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error, warning: null }
  const { supabase, userId } = auth

  const parsed = updateDirectTaskStatusSchema.safeParse({ taskId, status })
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors, warning: null }
  }
  const input = parsed.data

  const { data: taskInfo } = await supabase
    .from('direct_tasks')
    .select('title, assignee_id')
    .eq('id', input.taskId)
    .single()

  const { error } = await supabase.from('direct_tasks').update({ status: input.status }).eq('id', input.taskId)
  if (error) return { error: error.message, warning: null }

  await writeLog(supabase, userId, 'direct_task', input.taskId, 'direct_task.status_changed', {
    status: input.status,
    title: taskInfo?.title,
  })

  // WIP-check после успешного обновления — мягкий, информационный.
  let warning: string | null = null
  if (input.status === 'in_progress' && taskInfo?.assignee_id) {
    const { getUserWip } = await import('@/lib/wip')
    const wip = await getUserWip(supabase, taskInfo.assignee_id)
    if (wip.state === 'over') {
      warning = `WIP-лимит превышен: в работе ${wip.active} из ${wip.limit}. Заверши одно из текущих, прежде чем брать новое.`
    }
  }

  revalidatePath('/dashboard/assignments')
  revalidatePath('/dashboard/assign')
  return { error: null, warning }
}

/** Сотрудник пишет ответ к поручению и отправляет на проверку (status='review'). */
export async function submitDirectTaskFeedback(taskId: string, note: string, status: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = submitDirectTaskFeedbackSchema.safeParse({ taskId, note, status })
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data
  const trimmedNote = input.note.trim() || null

  const { data: taskInfo } = await supabase
    .from('direct_tasks')
    .select('title, created_by, status')
    .eq('id', input.taskId)
    .single()

  const { error } = await supabase.from('direct_tasks').update({
    employee_note: trimmedNote,
    status: input.status,
  }).eq('id', input.taskId)
  if (error) return { error: error.message }
  await writeLog(supabase, userId, 'direct_task', input.taskId, 'direct_task.feedback', {
    status: input.status,
    title: taskInfo?.title,
    note: trimmedNote,
  })

  // Уведомляем автора об ответе — он узнаёт сразу, не дожидаясь захода в журнал.
  if (taskInfo?.created_by && taskInfo.created_by !== userId) {
    // Если статус не меняется — это просто комментарий (например к уже выполненному).
    const isCommentOnly = taskInfo.status === input.status
    const action = isCommentOnly             ? 'добавил комментарий'
                 : input.status === 'review' ? 'отправил на проверку'
                 : input.status === 'done'   ? 'отметил выполненным'
                 :                             'обновил статус'
    const notePreview = trimmedNote ? ` — ${trimmedNote.slice(0, 80)}` : ''
    await supabase.from('notifications').insert({
      user_id: taskInfo.created_by,
      title: isCommentOnly ? 'Новый комментарий' : 'Ответ по поручению',
      message: `Исполнитель ${action}: "${taskInfo.title}"${notePreview}`,
      type: 'direct_task_feedback',
      linked_id: input.taskId,
    })
  }

  revalidatePath('/dashboard/assignments')
  revalidatePath('/dashboard/assign')
  return { error: null }
}
