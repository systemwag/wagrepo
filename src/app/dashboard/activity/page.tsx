import { redirect } from 'next/navigation'
import { Activity } from 'lucide-react'
import { getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import type { ActivityItem } from '@/components/ui/ActivityFeed'
import ActivityFeedWithLoadMore from './ActivityFeedWithLoadMore'
import ActivityFilters from './ActivityFilters'
import CleanupButton from './CleanupButton'
import { fetchActivityPage, type EntityFilter } from './actions'
import { hasDirectorAccess } from '@/lib/roles'

const PAGE_SIZE = 50

const VALID_ENTITIES: ActivityItem['entity_type'][] = [
  'direct_task', 'project_task', 'project', 'stage', 'event', 'poll', 'daily_report',
]

function parseEntity(raw: string | string[] | undefined): EntityFilter {
  if (typeof raw !== 'string') return null
  return (VALID_ENTITIES as string[]).includes(raw) ? (raw as EntityFilter) : null
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string | string[] }>
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!hasDirectorAccess(profile.role)) redirect('/dashboard')

  const sp = await searchParams
  const entity = parseEntity(sp.entity)

  const initial = await fetchActivityPage(0, PAGE_SIZE, entity)

  return (
    <div>
      <PageHeader
        icon={<Activity size={18} />}
        iconTone="green"
        title="Пульс компании"
        subtitle="Хронология всех действий в системе. Записи старше 30 дней удаляются автоматически."
        action={<CleanupButton daysOld={30} />}
      />
      <ActivityFilters active={entity} />
      <ActivityFeedWithLoadMore initial={initial} pageSize={PAGE_SIZE} entity={entity} />
    </div>
  )
}
