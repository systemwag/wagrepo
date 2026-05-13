'use client'

import ActivityFeed, { ActivityItem } from '@/components/ui/ActivityFeed'
import { LoadMore } from '@/components/ui/LoadMore'
import { fetchActivityPage } from './actions'

export default function ActivityFeedWithLoadMore({
  initial,
  pageSize,
}: {
  initial: ActivityItem[]
  pageSize: number
}) {
  return (
    <LoadMore<ActivityItem>
      initial={initial}
      pageSize={pageSize}
      fetchMore={(page) => fetchActivityPage(page, pageSize)}
      emptyMessage="Активности пока нет"
      renderItems={(items) => <ActivityFeed activities={items} />}
    />
  )
}
