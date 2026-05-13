import { redirect } from 'next/navigation'
import { Activity } from 'lucide-react'
import { getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import ActivityFeedWithLoadMore from './ActivityFeedWithLoadMore'
import { fetchActivityPage } from './actions'

export const revalidate = 30
const PAGE_SIZE = 50

export default async function ActivityPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'director') redirect('/dashboard')

  const initial = await fetchActivityPage(0, PAGE_SIZE)

  return (
    <div>
      <PageHeader
        icon={<Activity size={18} />}
        iconTone="green"
        title="Пульс компании"
        subtitle="Хронология всех действий в системе — задачи, стадии проектов, мероприятия"
      />
      <ActivityFeedWithLoadMore initial={initial} pageSize={PAGE_SIZE} />
    </div>
  )
}
