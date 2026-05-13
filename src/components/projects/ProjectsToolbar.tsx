'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useHaptic } from '@/lib/hooks/useHaptic'
import {
  Search, X, ArrowUpDown, ArrowDown, ArrowUp, SlidersHorizontal, Check,
  LayoutList, LayoutGrid, Table as TableIcon,
} from 'lucide-react'

export type ProjectStatusFilter = 'all' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'overdue'
export type ProjectSort =
  | 'created_desc'
  | 'created_asc'
  | 'deadline_asc'
  | 'deadline_desc'
  | 'name_asc'
  | 'budget_desc'
export type ProjectView = 'list' | 'grid' | 'table'

const STATUS_OPTIONS: { value: ProjectStatusFilter; label: string; tone?: string }[] = [
  { value: 'all',       label: 'Все' },
  { value: 'overdue',   label: 'Просрочены', tone: 'var(--color-danger)' },
  { value: 'active',    label: 'Активные',   tone: 'var(--color-green)' },
  { value: 'on_hold',   label: 'На паузе',   tone: 'var(--color-warn)' },
  { value: 'completed', label: 'Завершённые',tone: 'var(--color-info)' },
]

const SORT_OPTIONS: { value: ProjectSort; label: string; icon: React.ReactNode }[] = [
  { value: 'created_desc',  label: 'Сначала новые',         icon: <ArrowDown size={14} /> },
  { value: 'created_asc',   label: 'Сначала старые',        icon: <ArrowUp size={14} /> },
  { value: 'deadline_asc',  label: 'Дедлайн: ближайший',    icon: <ArrowUp size={14} /> },
  { value: 'deadline_desc', label: 'Дедлайн: дальний',      icon: <ArrowDown size={14} /> },
  { value: 'name_asc',      label: 'По названию (А-Я)',     icon: <ArrowUpDown size={14} /> },
  { value: 'budget_desc',   label: 'По бюджету (убыв.)',    icon: <ArrowDown size={14} /> },
]

export function ProjectsToolbar({
  total,
  visible,
}: {
  total: number
  visible: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const haptic = useHaptic()

  const q       = search.get('q') ?? ''
  const status  = (search.get('status') as ProjectStatusFilter) ?? 'all'
  const sort    = (search.get('sort')   as ProjectSort)         ?? 'created_desc'

  const [qLocal, setQLocal] = useState(q)
  useEffect(() => setQLocal(q), [q])

  const [sheetOpen, setSheetOpen] = useState(false)

  // Debounce поиска — 250ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (qLocal !== q) updateParams({ q: qLocal || null })
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal])

  function updateParams(patch: Record<string, string | null>, hapticHit = true) {
    const params = new URLSearchParams(search.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') params.delete(k)
      else params.set(k, v)
    }
    const queryStr = params.toString()
    if (hapticHit) haptic.tap()
    startTransition(() => {
      router.replace(queryStr ? `${pathname}?${queryStr}` : pathname, { scroll: false })
    })
  }

  function reset() {
    setQLocal('')
    startTransition(() => router.replace(pathname, { scroll: false }))
  }

  const activeFiltersCount = useMemo(() => {
    let n = 0
    if (q) n++
    if (status && status !== 'all') n++
    if (sort && sort !== 'created_desc') n++
    return n
  }, [q, status, sort])

  // Скролл-тень: когда тулбар «прилип» к верху, появляется тень — индикатор скролла.
  const stickyRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)
  useEffect(() => {
    const el = stickyRef.current
    if (!el) return
    const sentinel = document.createElement('div')
    sentinel.style.cssText = 'position:absolute;left:0;top:-1px;width:1px;height:1px;'
    el.appendChild(sentinel)
    const io = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: [1] },
    )
    io.observe(sentinel)
    return () => {
      io.disconnect()
      sentinel.remove()
    }
  }, [])

  return (
    <div
      ref={stickyRef}
      data-stuck={isStuck}
      className="sticky z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-4
                 transition-shadow duration-200 backdrop-blur-md
                 data-[stuck=true]:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
      style={{
        top: 'calc(-1px + env(safe-area-inset-top, 0px))',
        background: 'color-mix(in oklab, var(--color-bg) 82%, transparent)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        {/* Поиск */}
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
          <input
            type="search"
            inputMode="search"
            value={qLocal}
            onChange={e => setQLocal(e.target.value)}
            placeholder="Поиск по названию, заказчику, № договора"
            className="input pl-9 pr-9"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {qLocal && (
            <button
              onClick={() => setQLocal('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-text-dim hover:text-text hover:bg-surface-2"
              aria-label="Очистить поиск"
              type="button"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Переключатель режимов (desktop) */}
        <div
          className="hidden lg:inline-flex items-center h-10 rounded-xl bg-surface-2 border border-border-2 p-0.5"
          role="radiogroup"
          aria-label="Режим отображения"
        >
          {([
            { v: 'list',  icon: <LayoutList size={15} />, label: 'Список' },
            { v: 'grid',  icon: <LayoutGrid size={15} />, label: 'Сетка' },
            { v: 'table', icon: <TableIcon size={15} />,  label: 'Таблица' },
          ] as const).map(opt => {
            const active = (search.get('view') ?? 'list') === opt.v
            return (
              <button
                key={opt.v}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={opt.label}
                title={opt.label}
                onClick={() => updateParams({ view: opt.v === 'list' ? null : opt.v })}
                className="px-2.5 h-full inline-flex items-center justify-center rounded-[8px] transition-colors text-text-dim hover:text-text data-[active=true]:text-green data-[active=true]:bg-[color:color-mix(in_oklab,var(--color-green)_15%,transparent)]"
                data-active={active}
              >
                {opt.icon}
              </button>
            )
          })}
        </div>

        {/* Сортировка — popover */}
        <SortPopover value={sort} onChange={(v) => updateParams({ sort: v === 'created_desc' ? null : v })} />

        {/* Кнопка фильтров (для мобильного — бóльшая, открывает sheet) */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="md:hidden inline-flex items-center gap-1.5 px-3 h-10 rounded-xl text-sm font-medium text-text-muted bg-surface-2 border border-border-2 hover:text-text relative"
          aria-label="Фильтры"
        >
          <SlidersHorizontal size={16} />
          <span>Фильтры</span>
          {activeFiltersCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center num"
              style={{ background: 'var(--color-green)', color: '#040d07' }}
            >
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Status pills — desktop */}
      <div className="hidden md:flex items-center gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map(opt => (
          <StatusPill
            key={opt.value}
            active={status === opt.value || (opt.value === 'all' && !status)}
            label={opt.label}
            tone={opt.tone}
            onClick={() => updateParams({ status: opt.value === 'all' ? null : opt.value })}
          />
        ))}

        {/* Счётчик и сброс */}
        <div className="ml-auto flex items-center gap-3 text-xs text-text-dim">
          <span className="num">
            {visible === total ? `${total} проектов` : `${visible} из ${total}`}
          </span>
          {activeFiltersCount > 0 && (
            <button
              onClick={reset}
              className="text-text-muted hover:text-text underline-offset-2 hover:underline"
              type="button"
            >
              Сбросить
            </button>
          )}
          {isPending && <span className="text-text-dim">обновление…</span>}
        </div>
      </div>

      {/* Счётчик результатов на mobile — внизу панели */}
      <div className="md:hidden flex items-center justify-between text-xs text-text-dim mt-2">
        <span className="num">
          {visible === total ? `${total} проектов` : `${visible} из ${total}`}
        </span>
        {activeFiltersCount > 0 && (
          <button
            onClick={reset}
            className="text-text-muted hover:text-text underline-offset-2 hover:underline"
            type="button"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Bottom-sheet с фильтрами для мобильного */}
      {sheetOpen && (
        <FiltersSheet
          onClose={() => setSheetOpen(false)}
          currentStatus={status}
          currentSort={sort}
          onStatusChange={(v) => updateParams({ status: v === 'all' ? null : v })}
          onSortChange={(v) => updateParams({ sort: v === 'created_desc' ? null : v })}
          onReset={reset}
          activeFiltersCount={activeFiltersCount}
        />
      )}
    </div>
  )
}

// ─── Pill ──────────────────────────────────────────────────────────────────
function StatusPill({
  active, label, tone, onClick,
}: {
  active: boolean
  label: string
  tone?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold border transition-all
                 bg-surface-2 border-border-2 text-text-muted
                 hover:text-text hover:border-border
                 data-[active=true]:scale-[1.03]"
      style={
        active
          ? {
              background: tone
                ? `color-mix(in oklab, ${tone} 15%, transparent)`
                : 'color-mix(in oklab, var(--color-green) 15%, transparent)',
              borderColor: tone
                ? `color-mix(in oklab, ${tone} 35%, transparent)`
                : 'color-mix(in oklab, var(--color-green) 35%, transparent)',
              color: tone ?? 'var(--color-green)',
            }
          : undefined
      }
    >
      {tone && active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />}
      {label}
    </button>
  )
}

// ─── Сортировка popover ───────────────────────────────────────────────────
function SortPopover({ value, onChange }: { value: ProjectSort; onChange: (v: ProjectSort) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const current = SORT_OPTIONS.find(o => o.value === value) ?? SORT_OPTIONS[0]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 h-10 rounded-xl text-sm font-medium text-text-muted bg-surface-2 border border-border-2 hover:text-text"
      >
        <ArrowUpDown size={14} />
        <span className="hidden sm:inline truncate max-w-[180px]">{current.label}</span>
        <span className="sm:hidden">Сорт.</span>
      </button>
      {open && (
        <div
          className="popover-enter absolute right-0 mt-1 z-40 w-64 p-1 rounded-xl bg-surface border border-border shadow-2xl"
          style={{ boxShadow: '0 16px 40px -8px rgba(0,0,0,0.6)' }}
        >
          {SORT_OPTIONS.map(opt => {
            const active = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors
                            ${active ? 'text-green' : 'text-text-muted hover:text-text hover:bg-surface-2'}`}
                style={active ? { background: 'color-mix(in oklab, var(--color-green) 12%, transparent)' } : undefined}
              >
                <span className="text-text-dim">{opt.icon}</span>
                <span className="flex-1">{opt.label}</span>
                {active && <Check size={14} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Bottom-sheet (mobile) ────────────────────────────────────────────────
function FiltersSheet({
  onClose, currentStatus, currentSort, onStatusChange, onSortChange, onReset, activeFiltersCount,
}: {
  onClose: () => void
  currentStatus: ProjectStatusFilter
  currentSort: ProjectSort
  onStatusChange: (v: ProjectStatusFilter) => void
  onSortChange: (v: ProjectSort) => void
  onReset: () => void
  activeFiltersCount: number
}) {
  // Блокируем скролл фона пока лист открыт
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="md:hidden">
      <div
        className="dialog-overlay fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        className="dialog-content fixed left-0 right-0 bottom-0 z-50 bg-surface border-t border-border rounded-t-2xl"
        style={{
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 -16px 40px rgba(0,0,0,0.45)',
        }}
      >
        {/* Тяжка */}
        <div className="flex items-center justify-center pt-3 sticky top-0 bg-surface">
          <span className="w-10 h-1 rounded-full bg-border-2" />
        </div>

        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text">Фильтры</h3>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => { onReset(); onClose() }}
                className="text-sm text-text-muted underline-offset-2 hover:underline"
              >
                Сбросить
              </button>
            )}
          </div>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">Статус</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(opt => (
                <StatusPill
                  key={opt.value}
                  active={currentStatus === opt.value || (opt.value === 'all' && !currentStatus)}
                  label={opt.label}
                  tone={opt.tone}
                  onClick={() => onStatusChange(opt.value)}
                />
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">Сортировка</p>
            <div className="flex flex-col gap-1">
              {SORT_OPTIONS.map(opt => {
                const active = currentSort === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSortChange(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors min-h-11
                                ${active ? 'text-green' : 'text-text-muted'}`}
                    style={active ? { background: 'color-mix(in oklab, var(--color-green) 12%, transparent)' } : undefined}
                  >
                    <span className="text-text-dim">{opt.icon}</span>
                    <span className="flex-1">{opt.label}</span>
                    {active && <Check size={14} />}
                  </button>
                )
              })}
            </div>
          </section>

          <button type="button" onClick={onClose} className="btn-green w-full">
            Применить
          </button>
        </div>
      </div>
    </div>
  )
}
