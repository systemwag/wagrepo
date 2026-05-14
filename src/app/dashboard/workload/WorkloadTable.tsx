'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, X, ArrowUp, ArrowDown, Pencil, Check, Loader2, AlertTriangle,
  Building2, User,
} from 'lucide-react'
import { updateWipLimit } from './actions'

export type WorkloadRow = {
  user_id: string
  full_name: string
  position: string | null
  department: string | null
  role: string
  wip_limit: number
  in_progress_count: number
  todo_count: number
  overdue_count: number
}

type SortKey = 'name' | 'load' | 'overdue' | 'todo'
type SortDir = 'asc' | 'desc'

export default function WorkloadTable({ rows }: { rows: WorkloadRow[] }) {
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('load')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filter, setFilter] = useState<'all' | 'over' | 'overdue' | 'idle'>('all')

  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.department) set.add(r.department)
    return Array.from(set).sort()
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows.filter(r => {
      if (q && !(
        r.full_name.toLowerCase().includes(q)
        || r.position?.toLowerCase().includes(q)
        || r.department?.toLowerCase().includes(q)
      )) return false
      if (dept !== 'all' && r.department !== dept) return false
      if (filter === 'over'    && r.in_progress_count <= r.wip_limit) return false
      if (filter === 'overdue' && r.overdue_count === 0) return false
      if (filter === 'idle'    && (r.in_progress_count > 0 || r.todo_count > 0)) return false
      return true
    })

    list = list.slice().sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':    cmp = a.full_name.localeCompare(b.full_name); break
        case 'load':    cmp = (a.in_progress_count / a.wip_limit) - (b.in_progress_count / b.wip_limit); break
        case 'overdue': cmp = a.overdue_count - b.overdue_count; break
        case 'todo':    cmp = a.todo_count - b.todo_count; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [rows, search, dept, filter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc') }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: поиск + отдел + быстрые фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, должности, отделу…"
            className="input"
            style={{ background: 'var(--surface)', paddingLeft: '2.5rem' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim">
              <X size={14} />
            </button>
          )}
        </div>

        {departments.length > 0 && (
          <select
            value={dept}
            onChange={e => setDept(e.target.value)}
            className="input"
            style={{ background: 'var(--surface)', paddingRight: '2.5rem', maxWidth: '220px' }}
          >
            <option value="all">Все отделы</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        <div className="flex gap-1 ml-auto">
          <FilterChip active={filter === 'all'}     onClick={() => setFilter('all')}     label="Все"          />
          <FilterChip active={filter === 'over'}    onClick={() => setFilter('over')}    label="Перегружены"  tone="danger" />
          <FilterChip active={filter === 'overdue'} onClick={() => setFilter('overdue')} label="С просрочкой" tone="warn"   />
          <FilterChip active={filter === 'idle'}    onClick={() => setFilter('idle')}    label="Без задач"    tone="muted"  />
        </div>
      </div>

      {/* Сортировка */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-text-dim">Сортировка:</span>
        <SortBtn current={sortKey} dir={sortDir} k="load"    label="по загрузке"      onClick={toggleSort} />
        <SortBtn current={sortKey} dir={sortDir} k="overdue" label="по просрочкам"    onClick={toggleSort} />
        <SortBtn current={sortKey} dir={sortDir} k="todo"    label="по очереди"       onClick={toggleSort} />
        <SortBtn current={sortKey} dir={sortDir} k="name"    label="по имени"         onClick={toggleSort} />
      </div>

      {/* Карточки сотрудников */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center text-sm"
          style={{ background: 'var(--surface)', border: '1px dashed var(--border)', color: 'var(--text-dim)' }}
        >
          Никого не нашли по этим фильтрам
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(r => <EmployeeCard key={r.user_id} row={r} />)}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function FilterChip({
  active, onClick, label, tone,
}: { active: boolean; onClick: () => void; label: string; tone?: 'danger' | 'warn' | 'muted' }) {
  const color = tone === 'danger' ? 'var(--color-danger)'
              : tone === 'warn'   ? 'var(--color-warn)'
              : tone === 'muted'  ? 'var(--text-muted)'
              :                     'var(--color-green)'
  return (
    <button
      onClick={onClick}
      className="text-xs font-medium px-2.5 py-1 rounded-lg border transition-all"
      style={{
        background: active ? `color-mix(in oklab, ${color} 15%, transparent)` : 'transparent',
        borderColor: active ? `color-mix(in oklab, ${color} 30%, transparent)` : 'var(--border)',
        color: active ? color : 'var(--text-muted)',
      }}
    >
      {label}
    </button>
  )
}

function SortBtn({
  current, dir, k, label, onClick,
}: { current: SortKey; dir: SortDir; k: SortKey; label: string; onClick: (k: SortKey) => void }) {
  const active = current === k
  return (
    <button
      onClick={() => onClick(k)}
      className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
      style={{
        background: active ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-muted)',
      }}
    >
      {label}
      {active && (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
    </button>
  )
}

// ─── Карточка сотрудника ─────────────────────────────────────────────────────

function EmployeeCard({ row }: { row: WorkloadRow }) {
  const initials = row.full_name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  const pct = row.wip_limit > 0 ? row.in_progress_count / row.wip_limit : 0
  const state: 'ok' | 'warning' | 'over' =
    row.in_progress_count > row.wip_limit ? 'over'
    : row.in_progress_count >= row.wip_limit - 1 && row.wip_limit > 0 ? 'warning'
    : 'ok'

  const stateColor = state === 'over' ? 'var(--color-danger)'
                   : state === 'warning' ? 'var(--color-warn)'
                   : 'var(--color-green)'

  return (
    <div
      className="rounded-2xl p-4 transition-colors"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${state === 'over' ? 'color-mix(in oklab, var(--color-danger) 30%, transparent)' : 'var(--border)'}`,
      }}
    >
      {/* Шапка: аватар, имя, отдел, статус */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-muted)',
            border: `2px solid ${state === 'over' ? 'var(--color-danger)' : 'var(--border)'}`,
          }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-text truncate">{row.full_name}</span>
            {state === 'over' && (
              <span
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                style={{
                  color: 'var(--color-danger)',
                  background: 'color-mix(in oklab, var(--color-danger) 12%, transparent)',
                  border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)',
                }}
              >
                <AlertTriangle size={9} /> Перегружен
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap text-text-muted">
            {row.position && <span><User size={10} className="inline mr-1" />{row.position}</span>}
            {row.department && (
              <span className="text-text-dim">
                · <Building2 size={10} className="inline mx-1" />{row.department}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Прогресс WIP */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-text-muted">В работе</span>
          <span className="num font-semibold" style={{ color: stateColor }}>
            {row.in_progress_count} / {row.wip_limit}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, pct * 100)}%`,
              background: stateColor,
            }}
          />
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="В очереди"   value={row.todo_count}    color="var(--color-info)" />
        <Metric label="Просрочено"  value={row.overdue_count} color={row.overdue_count > 0 ? 'var(--color-danger)' : 'var(--text-dim)'} />
        <WipLimitEditor userId={row.user_id} currentLimit={row.wip_limit} />
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="px-2.5 py-1.5 rounded-lg"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <p className="text-[10px] uppercase tracking-wider text-text-dim">{label}</p>
      <p className="text-base font-bold num leading-tight" style={{ color }}>{value}</p>
    </div>
  )
}

function WipLimitEditor({ userId, currentLimit }: { userId: string; currentLimit: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(currentLimit))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    const n = parseInt(value, 10)
    if (!Number.isFinite(n) || n < 1 || n > 50) {
      setError('1–50')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await updateWipLimit(userId, n)
      if (res.error) setError(res.error)
      else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  if (editing) {
    return (
      <div
        className="px-2 py-1 rounded-lg flex items-center gap-1"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--color-green)' }}
      >
        <input
          autoFocus
          type="number"
          min={1}
          max={50}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { setEditing(false); setValue(String(currentLimit)) }
          }}
          className="w-full text-base font-bold num bg-transparent border-0 outline-none p-0"
          style={{ color: 'var(--color-green)', minWidth: 0 }}
        />
        <button
          onClick={save}
          disabled={pending}
          className="flex-shrink-0 p-0.5"
          style={{ color: 'var(--color-green)' }}
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        </button>
        {error && <span className="text-[9px] text-danger flex-shrink-0">{error}</span>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors group"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      title="Изменить WIP-лимит"
    >
      <div className="text-left">
        <p className="text-[10px] uppercase tracking-wider text-text-dim">Лимит</p>
        <p className="text-base font-bold num leading-tight text-text">{currentLimit}</p>
      </div>
      <Pencil size={11} className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
    </button>
  )
}
