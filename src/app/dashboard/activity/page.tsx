import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import ActivityFeed, { ActivityItem } from '@/components/ui/ActivityFeed'

export const revalidate = 30

export default async function ActivityPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'director') redirect('/dashboard')

  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('activity_log')
    .select(`
      id, entity_type, entity_id, action, meta, created_at,
      actor:profiles!activity_log_actor_id_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  const activities: ActivityItem[] = (raw ?? []).map(r => {
    const actor = Array.isArray(r.actor) ? r.actor[0] : r.actor
    return {
      id: r.id,
      actor: { id: actor?.id ?? '', full_name: actor?.full_name ?? 'Неизвестно' },
      entity_type: r.entity_type as ActivityItem['entity_type'],
      entity_id: r.entity_id,
      action: r.action,
      meta: r.meta as Record<string, unknown> | null,
      created_at: r.created_at,
    }
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Пульс компании</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Хронология всех действий в системе — задачи, стадии проектов, мероприятия
        </p>
      </div>

      <ActivityFeed activities={activities} />
    </div>
  )
}
