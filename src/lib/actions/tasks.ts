'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  const { error } = await supabase.from('tasks').insert({
    title: formData.title.trim(),
    description: formData.description.trim() || null,
    assignee_id: formData.assignee_id,
    priority: formData.priority,
    created_by: user.id,
    status: 'todo',
    ...(formData.deadline ? { deadline: formData.deadline } : {}),
  })

  if (error) return { error: error.message }
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
  const { error } = await supabase.from('tasks').update({
    title: data.title.trim(),
    description: data.description.trim() || null,
    assignee_id: data.assignee_id,
    priority: data.priority,
    deadline: data.deadline || null,
  }).eq('id', taskId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/assign')
  return { error: null }
}

export async function deleteDirectTask(taskId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/assign')
  return { error: null }
}

export async function updateTaskStatus(taskId: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/tasks')
  return { error: null }
}

export async function submitTaskFeedback(taskId: string, note: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({
    employee_note: note.trim() || null,
    status,
  }).eq('id', taskId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/tasks')
  return { error: null }
}
