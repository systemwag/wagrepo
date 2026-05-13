'use server'

import { revalidatePath } from 'next/cache'
import { writeLog } from '@/lib/actions/log'
import { requireAuth } from '@/lib/auth'

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
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const { participant_ids, ...eventData } = input

  const { data: event, error } = await supabase
    .from('events')
    .insert({ ...eventData, created_by: userId })
    .select()
    .single()

  if (error) return { error: error.message }

  if (participant_ids && participant_ids.length > 0) {
    await supabase.from('event_participants').insert(
      participant_ids.map(uid => ({ event_id: event.id, user_id: uid }))
    )
  }

  await writeLog(supabase, userId, 'event', event.id, 'event.created', { title: input.title })
  revalidatePath('/dashboard/events')
  revalidatePath('/dashboard')
  return { data: event }
}

export async function updateEvent(id: string, input: EventInput) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const { participant_ids, ...eventData } = input

  const { error } = await supabase
    .from('events')
    .update(eventData)
    .eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('event_participants').delete().eq('event_id', id)
  if (participant_ids && participant_ids.length > 0) {
    await supabase.from('event_participants').insert(
      participant_ids.map(uid => ({ event_id: id, user_id: uid }))
    )
  }

  await writeLog(supabase, userId, 'event', id, 'event.updated', { title: input.title })
  revalidatePath('/dashboard/events')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteEvent(id: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const { data: eventInfo } = await supabase.from('events').select('title').eq('id', id).single()
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) return { error: error.message }
  await writeLog(supabase, userId, 'event', id, 'event.deleted', { title: eventInfo?.title ?? null })
  revalidatePath('/dashboard/events')
  revalidatePath('/dashboard')
  return { success: true }
}
