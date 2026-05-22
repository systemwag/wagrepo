'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { AlertTriangle, Filter, Flame, X, ChevronDown, Search } from 'lucide-react'
import type { JournalMember } from './JournalView'

type Filters = {
  dept:    string | null
  user:    string | null
  blocker: boolean
  heavy:   boolean
  problem: boolean
}

// Собираем query-string, сохраняя текущее окно (until / days) и view.
// Передавая null/undefined — удаляем параметр.
function buildHref(
  current: URLSearchParams,
  updates: Record<string, string | null | undefined>,
): string {
  const next = new URLSearchParams(current.toString())
  // Гарантируем что мы остаёмся в режиме «История».
  next.set('view', 'history')
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '' || value === '0') {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  }
  return `/dashboard/daily/team?${next.toString()}`
}

export default function JournalFilters({
  filters, members, departments,
}: {
  filters: Filters
  members: JournalMember[]
  departments: string[]
}) {
  const sp = useSearchParams()
  const router = useRouter()
  const params = sp ?? new URLSearchParams()

  const hasAny =
    filters.dept !== null ||
    filters.user !== null ||
    filters.blocker || filters.heavy || filters.problem

  return (
    <div
      className="p-3 rounded-2xl space-y-2 sticky z-20 backdrop-blur"
      style={{
        background: 'color-mix(in oklab, var(--surface) 92%, transparent)',
        border: '1px solid var(--border)',
        top: 'var(--page-sticky-top, 8px)',
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={12} style={{ color: 'var(--text-dim)' }} />
        <span className="text-xs font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--text-dim)' }}>
          Фильтры
        </span>

        {/* Отдел */}
        {departments.length > 0 && (
          <select
            value={filters.dept ?? ''}
            onChange={e => router.replace(buildHref(params, { dept: e.target.value || null }), { scroll: false })}
            className="text-xs rounded-lg px-2 py-1 outline-none"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="">Все отделы</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {/* Сотрудник — выпадайка с поиском */}
        <UserPicker
          members={members}
          selectedId={filters.user}
          onSelect={id => router.replace(buildHref(params, { user: id }), { scroll: false })}
        />

        {/* Чипы */}
        <FilterChip
          href={buildHref(params, { blocker: filters.blocker ? null : '1' })}
          active={filters.blocker} tone="danger"
        >
          <AlertTriangle size={11} /> С блокером
        </FilterChip>
        <FilterChip
          href={buildHref(params, { heavy: filters.heavy ? null : '1' })}
          active={filters.heavy} tone="warn"
        >
          <Flame size={11} /> Тяжело / Аврал
        </FilterChip>
        <FilterChip
          href={buildHref(params, { problem: filters.problem ? null : '1' })}
          active={filters.problem} tone="warn"
        >
          Проблемные дни
        </FilterChip>

        {hasAny && (
          <Link
            replace
            scroll={false}
            href={buildHref(new URLSearchParams(), {
              view: 'history',
              until: params.get('until') || undefined,
              days:  params.get('days')  || undefined,
            })}
            className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
          >
            <X size={11} /> сбросить
          </Link>
        )}
      </div>
    </div>
  )
}

// ── UserPicker: компактная выпадайка с поиском ───────────────────────────────
function UserPicker({
  members, selectedId, onSelect,
}: {
  members: JournalMember[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const selected = useMemo(
    () => members.find(m => m.id === selectedId) ?? null,
    [members, selectedId],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return members
    return members.filter(m => m.full_name.toLowerCase().includes(needle))
  }, [members, q])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 outline-none"
        style={{
          background: selected ? 'color-mix(in oklab, var(--color-info) 14%, transparent)' : 'var(--surface-2)',
          border: `1px solid ${selected
            ? 'color-mix(in oklab, var(--color-info) 35%, transparent)'
            : 'var(--border)'}`,
          color: selected ? 'var(--color-info)' : 'var(--text-dim)',
        }}
      >
        {selected ? selected.full_name : 'Все сотрудники'}
        <ChevronDown size={11} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 mt-1 z-40 w-64 rounded-xl shadow-lg overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                style={{ background: 'var(--surface-2)' }}>
                <Search size={12} style={{ color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  autoFocus
                  placeholder="Поиск…"
                  className="bg-transparent text-xs outline-none flex-1 min-w-0"
                  style={{ color: 'var(--text)' }}
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <button
                onClick={() => { onSelect(null); setOpen(false); setQ('') }}
                className="w-full text-left px-3 py-1.5 text-xs hover-surface"
                style={{ color: selectedId === null ? 'var(--color-green)' : 'var(--text-muted)' }}
              >
                Все сотрудники
              </button>
              {filtered.map(m => (
                <button key={m.id}
                  onClick={() => { onSelect(m.id); setOpen(false); setQ('') }}
                  className="w-full text-left px-3 py-1.5 hover-surface"
                  style={{ color: m.id === selectedId ? 'var(--color-info)' : 'var(--text-muted)' }}
                >
                  <p className="text-xs font-medium">{m.full_name}</p>
                  {m.department && (
                    <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{m.department}</p>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  Никого не нашлось
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Filter-chip как Link ─────────────────────────────────────────────────────
function FilterChip({ href, active, tone, children }: {
  href: string; active: boolean
  tone: 'warn' | 'danger' | 'info'
  children: React.ReactNode
}) {
  const color =
    tone === 'danger' ? '#f87171' :
    tone === 'warn'   ? '#fb923c' :
                        '#60a5fa'
  return (
    <Link
      replace
      scroll={false}
      href={href}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
      style={{
        background: active ? `color-mix(in oklab, ${color} 14%, transparent)` : 'var(--surface-2)',
        border: `1px solid ${active ? `color-mix(in oklab, ${color} 35%, transparent)` : 'var(--border)'}`,
        color: active ? color : 'var(--text-dim)',
      }}
    >
      {children}
    </Link>
  )
}
