'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Универсальная кнопка догрузки страниц.
 *
 * Принимает initialItems и серверную функцию fetchMore (page-based).
 * Каждая страница — массив длиной до pageSize. Когда пришло меньше, считаем что закончилось.
 *
 * Список элементов рендерит сам потребитель — это сохраняет SSR для первой страницы
 * и позволяет вкладывать любую разметку.
 */
export function LoadMore<T>({
  initial,
  pageSize,
  fetchMore,
  renderItems,
  emptyMessage = 'Ничего не найдено',
}: {
  initial: T[]
  pageSize: number
  fetchMore: (page: number) => Promise<T[]>
  renderItems: (items: T[]) => ReactNode
  emptyMessage?: string
}) {
  const [items, setItems] = useState<T[]>(initial)
  const [page, setPage]   = useState(1)              // следующая страница для запроса
  const [done, setDone]   = useState(initial.length < pageSize)
  const [pending, startTransition] = useTransition()

  function loadMore() {
    startTransition(async () => {
      const next = await fetchMore(page)
      setItems(prev => [...prev, ...next])
      setPage(p => p + 1)
      if (next.length < pageSize) setDone(true)
    })
  }

  if (items.length === 0) {
    return (
      <div className="card py-16 text-center text-text-muted">{emptyMessage}</div>
    )
  }

  return (
    <>
      {renderItems(items)}
      {!done && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={pending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                       bg-surface border border-border text-text-muted
                       hover:bg-surface-2 hover:border-border-2 hover:text-text
                       disabled:opacity-50 disabled:cursor-wait transition-colors"
          >
            {pending ? (
              <>
                <span className="inline-block w-3 h-3 rounded-full bg-green animate-pulse" />
                Загружаем…
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Загрузить ещё
              </>
            )}
          </button>
        </div>
      )}
    </>
  )
}
