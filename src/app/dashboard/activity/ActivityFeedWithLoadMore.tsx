'use client'

import { useState, useTransition } from 'react'
import ActivityFeed, { ActivityItem } from '@/components/ui/ActivityFeed'
import { LoadMore } from '@/components/ui/LoadMore'
import { fetchActivityPage, deleteActivityEntry } from './actions'

export default function ActivityFeedWithLoadMore({
  initial,
  pageSize,
}: {
  initial: ActivityItem[]
  pageSize: number
}) {
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  // Optimistic delete: помечаем id как удалённый и убираем из выдачи до ответа сервера.
  // Если сервер отвечает ошибкой — возвращаем обратно.
  async function handleDelete(id: string) {
    setRemoved(prev => new Set(prev).add(id))
    const res = await deleteActivityEntry(id)
    if (res.error) {
      setRemoved(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      console.error('Не удалось удалить запись:', res.error)
      return
    }
    startTransition(() => {})
  }

  return (
    <LoadMore<ActivityItem>
      initial={initial}
      pageSize={pageSize}
      fetchMore={(page) => fetchActivityPage(page, pageSize)}
      emptyMessage="Активности пока нет"
      renderItems={(items) => (
        <ActivityFeed
          activities={items.filter(i => !removed.has(i.id))}
          onDelete={handleDelete}
        />
      )}
    />
  )
}
