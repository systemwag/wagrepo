'use server'

import { revalidatePath } from 'next/cache'
import { writeLog } from '@/lib/actions/log'
import { requireAuth } from '@/lib/auth'
import { eventIdSchema, eventInputSchema } from '@/lib/validation/events'

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

  const parsed = eventInputSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data
  const { participant_ids, ...eventData } = data

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

  await writeLog(supabase, userId, 'event', event.id, 'event.created', { title: data.title })
  revalidatePath('/dashboard/events')
  revalidatePath('/dashboard')
  return { data: event }
}

export async function updateEvent(id: string, input: EventInput) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const idParsed = eventIdSchema.safeParse(id)
  if (!idParsed.success) return { error: 'Некорректный идентификатор события' }

  const parsed = eventInputSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data
  const { participant_ids, ...eventData } = data
  const eventId = idParsed.data

  // Снимок до апдейта: нужны старые поля для сравнения + список текущих участников
  // для diff-update (не пересоздаём всех, чтобы не спамить триггер уведомлений).
  const [{ data: oldEvent }, { data: oldParticipants }] = await Promise.all([
    supabase.from('events')
      .select('title, date, start_time, end_time, location')
      .eq('id', eventId)
      .single(),
    supabase.from('event_participants')
      .select('user_id')
      .eq('event_id', eventId),
  ])

  const { error } = await supabase.from('events').update(eventData).eq('id', eventId)
  if (error) return { error: error.message }

  // Diff-обновление участников: триггер notify_event_participant сработает
  // ТОЛЬКО на реально новых (миграция 013), без спама на каждое сохранение.
  const oldIds = new Set((oldParticipants ?? []).map(p => p.user_id as string))
  const newIds = new Set((participant_ids ?? []).filter(Boolean))
  const toRemove = [...oldIds].filter(uid => !newIds.has(uid))
  const toAdd    = [...newIds].filter(uid => !oldIds.has(uid))

  if (toRemove.length > 0) {
    await supabase.from('event_participants')
      .delete()
      .eq('event_id', eventId)
      .in('user_id', toRemove)
  }
  if (toAdd.length > 0) {
    await supabase.from('event_participants').insert(
      toAdd.map(uid => ({ event_id: eventId, user_id: uid }))
    )
  }

  // Уведомления о переносе: если изменилось что-то «человекозначимое» —
  // шлём notification только тем, кто остаётся в участниках (новые получат
  // своё уведомление через триггер на INSERT, ушедшие — не их забота).
  if (oldEvent) {
    const changedTitle    = oldEvent.title       !== data.title
    const changedDate     = oldEvent.date        !== data.date
    const changedStart    = (oldEvent.start_time ?? null) !== (data.start_time ?? null)
    const changedEnd      = (oldEvent.end_time   ?? null) !== (data.end_time   ?? null)
    const changedLocation = (oldEvent.location   ?? null) !== (data.location   ?? null)

    if (changedTitle || changedDate || changedStart || changedEnd || changedLocation) {
      const stayingIds = [...oldIds].filter(uid => newIds.has(uid) && uid !== userId)
      if (stayingIds.length > 0) {
        const parts: string[] = []
        if (changedDate)     parts.push(`новая дата ${data.date}`)
        if (changedStart || changedEnd) parts.push(`время ${data.start_time ?? '—'}${data.end_time ? `–${data.end_time}` : ''}`)
        if (changedLocation) parts.push(`место: ${data.location || '—'}`)
        if (changedTitle)    parts.push(`новое название: ${data.title}`)
        const detail = parts.join(' · ')

        await supabase.from('notifications').insert(
          stayingIds.map(uid => ({
            user_id: uid,
            title: 'Мероприятие изменено',
            message: `«${data.title}» — ${detail}`,
            type: 'event' as const,
            linked_id: eventId,
          }))
        )
      }
    }
  }

  await writeLog(supabase, userId, 'event', eventId, 'event.updated', { title: data.title })
  revalidatePath('/dashboard/events')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteEvent(id: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = eventIdSchema.safeParse(id)
  if (!parsed.success) return { error: 'Некорректный идентификатор события' }
  const eventId = parsed.data

  // Снимок до удаления: title + участники для рассылки «отменено». После DELETE
  // junction event_participants чистится каскадно — снимок нужен ДО.
  const [{ data: eventInfo }, { data: participants }] = await Promise.all([
    supabase.from('events').select('title').eq('id', eventId).single(),
    supabase.from('event_participants').select('user_id').eq('event_id', eventId),
  ])

  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) return { error: error.message }

  // Шлём всем участникам, кроме того кто удалил (вероятно сам автор).
  const recipients = (participants ?? [])
    .map(p => p.user_id as string)
    .filter(uid => uid !== userId)
  if (recipients.length > 0) {
    await supabase.from('notifications').insert(
      recipients.map(uid => ({
        user_id: uid,
        title: 'Мероприятие отменено',
        message: `«${eventInfo?.title ?? 'Без названия'}» — отменено`,
        type: 'event' as const,
        linked_id: eventId,
      }))
    )
  }

  await writeLog(supabase, userId, 'event', eventId, 'event.deleted', { title: eventInfo?.title ?? null })
  revalidatePath('/dashboard/events')
  revalidatePath('/dashboard')
  return { success: true }
}
