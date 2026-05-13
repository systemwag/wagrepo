'use server'

import { requireDirector } from '@/lib/auth'
import type { ActivityItem } from '@/components/ui/ActivityFeed'

const SELECT = `
  id, entity_type, entity_id, action, meta, created_at,
  actor:profiles!activity_log_actor_id_fkey(id, full_name)
`

export async function fetchActivityPage(page: number, pageSize: number): Promise<ActivityItem[]> {
  const auth = await requireDirector()
  if (!auth.ok) return []

  const from = page * pageSize
  const to   = from + pageSize - 1

  const { data } = await auth.supabase
    .from('activity_log')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .range(from, to)

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
