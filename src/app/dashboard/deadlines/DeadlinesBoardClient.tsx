'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, X, Search } from 'lucide-react'
import TrafficLightBoard, {
  type DeadlineItem,
  type DeadlineEntityType,
} from '@/components/ui/TrafficLightBoard'
import { createClient } from '@/lib/supabase/client'

interface Props {
  items: DeadlineItem[]
}

type TypeFilter = 'all' | DeadlineEntityType

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all',          label: 'Все' },
  { value: 'project',      label: 'Проекты' },
  { value: 'project_task', label: 'Задачи' },
  { value: 'direct_task',  label: 'Поручения' },
  { value: 'checklist',    label: 'Чек-листы' },
]

export default function DeadlinesBoardClient({ items }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')

  // Уникальные ассигни и проекты — из текущей выдачи (после сервер-фильтров).
  const allAssignees = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) {
      for (const a of it.assignees) map.set(a.id, a.full_name)
    }
    return Array.from(map.entries())
      .map(([id, full_name]) => ({ id, full_name }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))
  }, [items])

  const allProjects = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) {
      if (it.projectId && it.projectName) map.set(it.projectId, it.projectName)
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(it => {
      if (typeFilter !== 'all' && it.type !== typeFilter) return false
      if (assigneeFilter !== 'all' && !it.assignees.some(a => a.id === assigneeFilter)) return false
      if (projectFilter !== 'all' && it.projectId !== projectFilter) return false
      if (q) {
        const hay = (it.title + ' ' + (it.projectName ?? '')).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, search, typeFilter, assigneeFilter, projectFilter])

  // Realtime: подписываемся на изменения 4 таблиц. На любое изменение —
  // router.refresh() пересчитает серверный компонент. Realtime включён для
  // direct_tasks/project_tasks (014) и project_stages (061); для projects и
  // stage_checklist_items таймер revalidate=60 страховать будет.
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('deadlines-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_tasks'  }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_stages'}, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [router])

  const hasActiveFilters = typeFilter !== 'all' || assigneeFilter !== 'all' || projectFilter !== 'all' || search.length > 0
  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (assigneeFilter !== 'all' ? 1 : 0) +
    (projectFilter !== 'all' ? 1 : 0)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  function resetFilters() {
    setSearch('')
    setTypeFilter('all')
    setAssigneeFilter('all')
    setProjectFilter('all')
  }

  const totalCount = items.length
  const filteredCount = filtered.length

  return (
    <div className="space-y-4">
      {/* Тулбар фильтров */}
      <div className="card p-3 flex flex-col md:flex-row md:items-center gap-3">
        {/* Поиск + кнопка фильтров на мобиле */}
        <div className="flex items-center gap-2 md:flex-1 md:min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-dim)' }} />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по названию или проекту…"
              className="input w-full pl-9"
            />
          </div>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(o => !o)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors hover-surface shrink-0 relative"
            style={{
              color: activeFilterCount > 0 ? 'var(--color-green)' : 'var(--text-muted)',
              border: `1px solid ${activeFilterCount > 0 ? 'color-mix(in oklab, var(--color-green) 35%, transparent)' : 'var(--border)'}`,
            }}
            aria-label="Фильтры"
          >
            <Filter size={14} />
            {activeFilterCount > 0 && (
              <span className="text-xs num font-semibold">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Группа: тип / сотрудник / проект / сброс. На мобиле скрыта пока не toggled. */}
        <div className={`${mobileFiltersOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-2 md:items-center`}>
          <Select value={typeFilter} onChange={v => setTypeFilter(v as TypeFilter)} options={TYPE_OPTIONS} ariaLabel="Тип" />

          <Select
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            options={[
              { value: 'all', label: 'Все сотрудники' },
              ...allAssignees.map(a => ({ value: a.id, label: a.full_name })),
            ]}
            ariaLabel="Сотрудник"
          />

          <Select
            value={projectFilter}
            onChange={setProjectFilter}
            options={[
              { value: 'all', label: 'Все проекты' },
              ...allProjects.map(p => ({ value: p.id, label: p.name })),
            ]}
            ariaLabel="Проект"
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors hover-surface shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={13} />
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Сводка под тулбаром */}
      <div className="flex items-center gap-2 text-xs px-1" style={{ color: 'var(--text-dim)' }}>
        <Filter size={12} />
        <span>
          Показано <b style={{ color: 'var(--text)' }}>{filteredCount}</b> из {totalCount}
        </span>
      </div>

      <TrafficLightBoard items={filtered} />
    </div>
  )
}

function Select<T extends string>({
  value, onChange, options, ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: string; label: string }[]
  ariaLabel: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="input text-sm cursor-pointer w-full md:w-auto md:max-w-[200px] md:shrink-0"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
