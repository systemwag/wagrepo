'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeLog } from '@/lib/actions/log'

export async function createDirectTask(formData: {
  title: string
  description: string
  assignee_id: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  deadline: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: task, error } = await supabase.from('tasks').insert({
    title: formData.title.trim(),
    description: formData.description.trim() || null,
    assignee_id: formData.assignee_id,
    priority: formData.priority,
    created_by: user.id,
    status: 'todo',
    ...(formData.deadline ? { deadline: formData.deadline } : {}),
  }).select('id').single()

  if (error) return { error: error.message }
  await writeLog(supabase, user.id, 'task', task.id, 'task.created', {
    title: formData.title.trim(),
    assignee_id: formData.assignee_id,
    priority: formData.priority,
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rows = formData.assignee_ids.map(assignee_id => ({
    title: formData.title.trim(),
    description: formData.description.trim() || null,
    assignee_id,
    priority: formData.priority,
    created_by: user.id,
    status: 'todo',
    ...(formData.deadline ? { deadline: formData.deadline } : {}),
  }))

  const { data: tasks, error } = await supabase.from('tasks').insert(rows).select('id')
  if (error) return { error: error.message }

  if (tasks && tasks.length > 0) {
    const logRows = tasks.map((task, i) => ({
      actor_id: user.id,
      entity_type: 'task' as const,
      entity_id: task.id,
      action: 'task.created',
      meta: {
        title: formData.title.trim(),
        assignee_id: formData.assignee_ids[i],
        priority: formData.priority,
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase.from('tasks').update({
    title: data.title.trim(),
    description: data.description.trim() || null,
    assignee_id: data.assignee_id,
    priority: data.priority,
    deadline: data.deadline || null,
  }).eq('id', taskId)
  if (error) return { error: error.message }
  await writeLog(supabase, user.id, 'task', taskId, 'task.updated', { title: data.title.trim() })
  revalidatePath('/dashboard/assign')
  return { error: null }
}

export async function deleteDirectTask(taskId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) return { error: error.message }
  await writeLog(supabase, user.id, 'task', taskId, 'task.deleted')
  revalidatePath('/dashboard/assign')
  return { error: null }
}

export async function updateTaskStatus(taskId: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: taskInfo } = await supabase.from('tasks').select('title').eq('id', taskId).single()
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  if (error) return { error: error.message }
  await writeLog(supabase, user.id, 'task', taskId, 'task.status_changed', {
    status,
    title: taskInfo?.title,
  })
  revalidatePath('/dashboard/tasks')
  return { error: null }
}

export async function submitTaskFeedback(taskId: string, note: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: taskInfo } = await supabase.from('tasks').select('title').eq('id', taskId).single()
  const { error } = await supabase.from('tasks').update({
    employee_note: note.trim() || null,
    status,
  }).eq('id', taskId)
  if (error) return { error: error.message }
  await writeLog(supabase, user.id, 'task', taskId, 'task.feedback', {
    status,
    title: taskInfo?.title,
    note: note.trim() || null,
  })
  revalidatePath('/dashboard/tasks')
  return { error: null }
}
