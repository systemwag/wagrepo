'use client'

import { useState, useTransition } from 'react'
import ActivityFeed, { ActivityItem } from '@/components/ui/ActivityFeed'
import { LoadMore } from '@/components/ui/LoadMore'
import { useToast } from '@/components/ui/Toast'
import { fetchActivityPage, deleteActivityEntry, type EntityFilter } from './actions'

export default function ActivityFeedWithLoadMore({
  initial,
  pageSize,
  entity,
}: {
  initial: ActivityItem[]
  pageSize: number
  entity: EntityFilter
}) {
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()
  const toast = useToast()

  // Optimistic delete: помечаем id как удалённый и убираем из выдачи до ответа сервера.
  // Если сервер отвечает ошибкой — возвращаем обратно и показываем тост.
  async function handleDelete(id: string) {
    setRemoved(prev => new Set(prev).add(id))
    const res = await deleteActivityEntry(id)
    if (res.error) {
      setRemoved(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast.show('error', `Не удалось удалить запись: ${res.error}`)
      return
    }
    startTransition(() => {})
  }

  return (
    // key={entity} — при смене фильтра LoadMore полностью пересоздаётся,
    // чтобы внутренний state items/page/done начался заново от свежего initial.
    <LoadMore<ActivityItem>
      key={entity ?? 'all'}
      initial={initial}
      pageSize={pageSize}
      fetchMore={(page) => fetchActivityPage(page, pageSize, entity)}
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
