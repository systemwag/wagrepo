'use client'

import { useMemo, useState } from 'react'
import { Search, Archive } from 'lucide-react'
import { LoadMore } from '@/components/ui/LoadMore'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { fetchProjectsPage, type ProjectListItem } from '../actions'

const PAGE_SIZE = 20

export default function ArchivedProjectsClient({
  initial,
  total,
  filterByManagerId,
}: {
  initial: ProjectListItem[]
  total: number
  filterByManagerId: string | null
}) {
  if (initial.length === 0 && total === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 py-20 rounded-2xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <Archive size={36} className="text-text-dim opacity-40" />
        <p className="text-sm text-text-muted">В архиве пока ничего нет</p>
        <p className="text-xs text-text-dim">Сюда попадают проекты со статусом «Завершён» или «Отменён»</p>
      </div>
    )
  }

  return (
    <LoadMore<ProjectListItem>
      initial={initial}
      pageSize={PAGE_SIZE}
      fetchMore={(page) => fetchProjectsPage(page, PAGE_SIZE, filterByManagerId, true)}
      emptyMessage=""
      renderItems={(items) => <ArchiveGrid items={items} />}
    />
  )
}

function ArchiveGrid({ items }: { items: ProjectListItem[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.client_name?.toLowerCase().includes(q) ?? false) ||
      (p.contract_number?.toLowerCase().includes(q) ?? false),
    )
  }, [items, query])

  return (
    <>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск по названию, заказчику, номеру договора"
          className="input w-full"
          style={{ paddingLeft: 36 }}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">Ничего не найдено</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  )
}
