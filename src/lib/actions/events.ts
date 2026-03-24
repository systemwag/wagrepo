'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeLog } from '@/lib/actions/log'

export type EventImportance = 'low' | 'medium' | 'high' | 'critical'

export type EventInput = {
  title: string
  description?: string
  date: string
  start_time?: string
  end_time?: string
  location?: string
  importance: EventImportance
  participant_ids?: string[]
}

export async function createEvent(input: EventInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { participant_ids, ...eventData } = input

  const { data: event, error } = await supabase
    .from('events')
    .insert({ ...eventData, created_by: user.id })
    .select()
    .single()

  if (error) return { error: error.message }

  if (participant_ids && participant_ids.length > 0) {
    await supabase.from('event_participants').insert(
      participant_ids.map(uid => ({ event_id: event.id, user_id: uid }))
    )
  }

  await writeLog(supabase, user.id, 'event', event.id, 'event.created', { title: input.title })
  revalidatePath('/dashboard/events')
  revalidatePath('/dashboard')
  return { data: event }
}

export async function updateEvent(id: string, input: EventInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { participant_ids, ...eventData } = input

  const { error } = await supabase
    .from('events')
    .update(eventData)
    .eq('id', id)

  if (error) return { error: error.message }

  // Полная замена участников
  await supabase.from('event_participants').delete().eq('event_id', id)
  if (participant_ids && participant_ids.length > 0) {
    await supabase.from('event_participants').insert(
      participant_ids.map(uid => ({ event_id: id, user_id: uid }))
    )
  }

  await writeLog(supabase, user.id, 'event', id, 'event.updated', { title: input.title })
  revalidatePath('/dashboard/events')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteEvent(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) return { error: error.message }
  await writeLog(supabase, user.id, 'event', id, 'event.deleted')
  revalidatePath('/dashboard/events')
  revalidatePath('/dashboard')
  return { success: true }
}
