'use server'

import { revalidatePath } from 'next/cache'
import { requireDirector } from '@/lib/auth'
import type { ActivityItem } from '@/components/ui/ActivityFeed'

const SELECT = `
  id, entity_type, entity_id, action, meta, created_at,
  actor:profiles!activity_log_actor_id_fkey(id, full_name)
`

export type EntityFilter = ActivityItem['entity_type'] | null

export async function fetchActivityPage(
  page: number,
  pageSize: number,
  entity: EntityFilter = null,
): Promise<ActivityItem[]> {
  const auth = await requireDirector()
  if (!auth.ok) return []

  const from = page * pageSize
  const to   = from + pageSize - 1

  let query = auth.supabase
    .from('activity_log')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (entity) query = query.eq('entity_type', entity)

  const { data } = await query

  return (data ?? []).map(r => {
    const actor = Array.isArray(r.actor) ? r.actor[0] : r.actor
    return {
      id: r.id,
      actor: { id: actor?.id ?? '', full_name: actor?.full_name ?? 'Неизвестно' },
      entity_type: r.entity_type as ActivityItem['entity_type'],
      entity_id: r.entity_id,
      action: r.action,
      meta: r.meta as Record<string, unknown> | null,
      created_at: r.created_at,
    } as ActivityItem
  })
}

/** Удалить одну запись из лога. Только директор. */
export async function deleteActivityEntry(entryId: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const { error } = await auth.supabase
    .from('activity_log')
    .delete()
    .eq('id', entryId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/activity')
  return { error: null }
}

/**
 * Очистить записи старее N дней (по умолчанию 30).
 * Возвращает количество удалённых строк.
 */
export async function cleanupOldActivity(daysOld = 30): Promise<{ error: string | null; deleted: number }> {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error, deleted: 0 }

  const threshold = new Date(Date.now() - daysOld * 86400000).toISOString()

  // Сначала считаем сколько удалим — чтобы вернуть осмысленный ответ.
  const { count } = await auth.supabase
    .from('activity_log')
    .select('id', { count: 'exact', head: true })
    .lt('created_at', threshold)

  const { error } = await auth.supabase
    .from('activity_log')
    .delete()
    .lt('created_at', threshold)
  if (error) return { error: error.message, deleted: 0 }

  revalidatePath('/dashboard/activity')
  return { error: null, deleted: count ?? 0 }
}
