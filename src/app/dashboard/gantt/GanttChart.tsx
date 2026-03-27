'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { ZoomIn, ZoomOut, Crosshair, Filter, ChevronDown, X, Calendar, User, Clock } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Stage = {
  id: string
  name: string
  order_index: number
  status: string | null
  start_date: string | null
  deadline: string | null
  assignee: { full_name: string } | null
}

export type Project = {
  id: string
  name: string
  status: string
  start_date: string | null
  deadline: string | null
  client_name: string | null
  manager: { full_name: string } | null
  stages: Stage[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LABEL_W = 264

const STAGE_COLORS = [
  '#22c55e', '#60a5fa', '#f59e0b', '#a78bfa',
  '#34d399', '#fb923c', '#38bdf8', '#f472b6',
]

// Pixels per day for each zoom level
const ZOOM_LEVELS = [
  { label: 'Год',      ppd: 4  },
  { label: 'Квартал',  ppd: 10 },
  { label: 'Месяц',   ppd: 24 },
  { label: 'Неделя',  ppd: 60 },
]
const DEFAULT_ZOOM = 1

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active:    { background: 'rgba(34,197,94,0.12)',  color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' },
  on_hold:   { background: 'rgba(234,179,8,0.1)',   color: '#ca8a04', border: '1px solid rgba(234,179,8,0.2)' },
  completed: { background: 'rgba(96,165,250,0.1)',  color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' },
  cancelled: { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' },
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Активный', on_hold: 'На паузе', completed: 'Завершён', cancelled: 'Отменён',
}
const MONTHS_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateDiff(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
function formatDate(d: Date) {
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`
}
function pluralDays(n: number) {
  const abs = Math.abs(n)
  if (abs === 1) return 'день'
  if (abs >= 2 && abs <= 4) return 'дня'
  return 'дней'
}

// Светофор: цвет и анимация пульса для этапа
function trafficColor(
  base: string,
  end: Date,
  today: Date,
  isDone: boolean,
): { color: string; pulse: boolean } {
  if (isDone) return { color: base, pulse: false }
  const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000)
  if (diff < 0)  return { color: '#ef4444', pulse: false }
  if (diff <= 1) return { color: '#fb923c', pulse: true  }
  if (diff <= 3) return { color: '#fbbf24', pulse: false }
  return { color: base, pulse: false }
}

// ─── Tooltip type ─────────────────────────────────────────────────────────────

type TooltipData = {
  name: string
  startDate: Date
  endDate: Date
  days: number
  assignee: string | null
  diffDays: number
  color: string
  screenX: number
  screenY: number
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GridLines({
  months, ppd, todayPx, chartWidth,
}: {
  months: { days: number }[]
  ppd: number
  todayPx: number
  chartWidth: number
}) {
  return (
    <>
      <div className="absolute inset-0 flex pointer-events-none overflow-hidden">
        {months.map((m, i) => (
          <div
            key={i}
            className="flex-shrink-0 h-full"
            style={{ width: m.days * ppd, borderRight: '1px solid rgba(26,38,32,0.3)' }}
          />
        ))}
      </div>
      {todayPx >= 0 && todayPx <= chartWidth && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-10"
          style={{ left: todayPx, width: 1, background: 'rgba(248,113,113,0.45)' }}
        />
      )}
    </>
  )
}

function Tooltip({ info, onClose }: { info: TooltipData; onClose: () => void }) {
  const diff = info.diffDays
  let diffLabel = ''
  let diffColor = 'var(--text-muted)'
  if (diff < 0) {
    diffLabel = `Просрочен на ${Math.abs(diff)} ${pluralDays(diff)}`
    diffColor = '#ef4444'
  } else if (diff === 0) {
    diffLabel = 'Дедлайн сегодня'
    diffColor = '#fb923c'
  } else if (diff === 1) {
    diffLabel = 'Завтра дедлайн'
    diffColor = '#fb923c'
  } else if (diff <= 3) {
    diffLabel = `Через ${diff} ${pluralDays(diff)}`
    diffColor = '#fbbf24'
  } else {
    diffLabel = `Через ${diff} ${pluralDays(diff)}`
  }

  // Position: попробуем показать над полоской, но не вылезать за экран
  const TW = 240
  const TH = 120
  let left = info.screenX - TW / 2
  let top  = info.screenY - TH - 10
  if (typeof window !== 'undefined') {
    if (left < 8) left = 8
    if (left + TW > window.innerWidth - 8) left = window.innerWidth - TW - 8
    if (top < 8) top = info.screenY + 28
  }

  return (
    <div
      className="fixed z-[200] rounded-2xl pointer-events-none"
      style={{
        left,
        top,
        width: TW,
        background: 'var(--surface)',
        border: `1px solid ${info.color}55`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${info.color}22`,
        padding: '12px 14px',
      }}
    >
      {/* Цветная полоска сверху */}
      <div style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 2, borderRadius: 99, background: info.color, opacity: 0.7 }} />

      <p className="text-sm font-semibold mb-2 pr-4 leading-snug" style={{ color: 'var(--text)' }}>
        {info.name}
      </p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Calendar size={11} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatDate(info.startDate)} → {formatDate(info.endDate)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={11} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {info.days} {pluralDays(info.days)}
            <span className="ml-2 font-semibold" style={{ color: diffColor }}>{diffLabel}</span>
          </span>
        </div>
        {info.assignee && (
          <div className="flex items-center gap-2">
            <User size={11} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{info.assignee}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GanttChart({ projects }: { projects: Project[] }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  // Zoom
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM)
  const ppd = ZOOM_LEVELS[zoomIdx].ppd

  // Filters
  const [hideCompleted, setHideCompleted] = useState(true)
  const [hideCancelled, setHideCancelled] = useState(true)
  const [managerFilter, setManagerFilter] = useState('all')
  const [filtersOpen, setFiltersOpen]     = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

  // Tooltip
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  // Scroll container ref
  const scrollRef = useRef<HTMLDivElement>(null)

  // Close filters on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Timeline range ──
  const { months, rangeStart, totalDays } = useMemo(() => {
    const allDates: Date[] = []
    projects.forEach(p => {
      if (p.start_date) allDates.push(new Date(p.start_date))
      if (p.deadline)   allDates.push(new Date(p.deadline))
      p.stages?.forEach(s => {
        if (s.start_date) allDates.push(new Date(s.start_date))
        if (s.deadline)   allDates.push(new Date(s.deadline))
      })
    })
    if (!allDates.length) allDates.push(today)

    const base = new Date(Math.min(...allDates.map(d => d.getTime())))
    const cap  = new Date(Math.max(...allDates.map(d => d.getTime())))
    const rangeStart = new Date(base.getFullYear(), base.getMonth() - 1, 1)
    const rangeEnd   = new Date(cap.getFullYear(),  cap.getMonth() + 2, 0)
    const totalDays  = Math.max(1, Math.ceil(dateDiff(rangeStart, rangeEnd)))

    const months: { label: string; days: number }[] = []
    const cur = new Date(rangeStart)
    while (cur <= rangeEnd) {
      const y = cur.getFullYear(), m = cur.getMonth()
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const days = Math.min(daysInMonth - cur.getDate() + 1, totalDays)
      months.push({
        label: `${MONTHS_RU[m]}${y !== today.getFullYear() ? ' ' + y : ''}`,
        days,
      })
      cur.setMonth(m + 1); cur.setDate(1)
    }

    return { months, rangeStart, totalDays }
  }, [projects, today])

  const chartWidth = totalDays * ppd
  const todayPx = dateDiff(rangeStart, today) * ppd

  function px(d: Date) { return Math.max(0, dateDiff(rangeStart, d) * ppd) }

  // ── Auto-scroll to today ──
  useEffect(() => {
    if (!scrollRef.current) return
    const cw = scrollRef.current.clientWidth - LABEL_W
    scrollRef.current.scrollLeft = Math.max(0, todayPx - cw / 2)
  }, [todayPx, ppd])

  // ── Managers list for filter ──
  const managers = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    projects.forEach(p => {
      const name = (Array.isArray(p.manager) ? (p.manager[0] as { full_name: string } | null) : p.manager)?.full_name
      if (name && !seen.has(name)) { seen.add(name); list.push(name) }
    })
    return list
  }, [projects])

  // ── Filtered projects ──
  const visible = useMemo(() => projects.filter(p => {
    if (hideCompleted && p.status === 'completed') return false
    if (hideCancelled && p.status === 'cancelled') return false
    if (managerFilter !== 'all') {
      const name = (Array.isArray(p.manager) ? (p.manager[0] as { full_name: string } | null) : p.manager)?.full_name
      if (name !== managerFilter) return false
    }
    return true
  }), [projects, hideCompleted, hideCancelled, managerFilter])

  const activeFilters = hideCompleted || hideCancelled || managerFilter !== 'all'

  if (projects.length === 0) {
    return (
      <div className="card py-20 text-center">
        <p style={{ color: 'var(--text-muted)' }}>Нет проектов</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Создайте проект с этапами</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">

      {/* ── Toolbar ── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-wrap"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
      >
        {/* Zoom buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomIdx(i => Math.max(0, i - 1))}
            disabled={zoomIdx === 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: zoomIdx === 0 ? 'var(--text-dim)' : 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <ZoomOut size={13} />
          </button>

          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {ZOOM_LEVELS.map((z, i) => (
              <button
                key={z.label}
                onClick={() => setZoomIdx(i)}
                className="px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  background: zoomIdx === i ? 'var(--green-glow)' : 'var(--surface)',
                  color: zoomIdx === i ? 'var(--green)' : 'var(--text-dim)',
                  borderRight: i < ZOOM_LEVELS.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {z.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setZoomIdx(i => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
            disabled={zoomIdx === ZOOM_LEVELS.length - 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: zoomIdx === ZOOM_LEVELS.length - 1 ? 'var(--text-dim)' : 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <ZoomIn size={13} />
          </button>
        </div>

        {/* Scroll to today */}
        <button
          onClick={() => {
            if (!scrollRef.current) return
            const cw = scrollRef.current.clientWidth - LABEL_W
            scrollRef.current.scrollTo({ left: Math.max(0, todayPx - cw / 2), behavior: 'smooth' })
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          <Crosshair size={12} />
          Сегодня
        </button>

        {/* Filters */}
        <div className="relative ml-auto" ref={filtersRef}>
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: filtersOpen ? 'var(--green-glow)' : 'var(--surface)',
              color: filtersOpen ? 'var(--green)' : 'var(--text-muted)',
              border: `1px solid ${filtersOpen ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            }}
          >
            <Filter size={12} />
            Фильтры
            {activeFilters && (
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
            )}
            <ChevronDown
              size={11}
              style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}
            />
          </button>

          {filtersOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 rounded-2xl z-50 p-3 flex flex-col gap-3"
              style={{
                minWidth: 220,
                background: 'var(--surface)',
                border: '1px solid var(--border-2)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              }}
            >
              <label className="flex items-center gap-2.5 cursor-pointer text-sm" style={{ color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={e => setHideCompleted(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-green-500"
                />
                Скрыть завершённые
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer text-sm" style={{ color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={hideCancelled}
                  onChange={e => setHideCancelled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-green-500"
                />
                Скрыть отменённые
              </label>

              {managers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                    Менеджер
                  </p>
                  <select
                    value={managerFilter}
                    onChange={e => setManagerFilter(e.target.value)}
                    className="w-full text-sm rounded-xl px-2.5 py-1.5 outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  >
                    <option value="all">Все менеджеры</option>
                    {managers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}

              {activeFilters && (
                <button
                  className="text-xs text-left transition-colors"
                  style={{ color: 'var(--text-dim)' }}
                  onClick={() => { setHideCompleted(false); setHideCancelled(false); setManagerFilter('all') }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)' }}
                >
                  <X size={10} className="inline mr-1" />
                  Сбросить фильтры
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Chart ── */}
      <div
        ref={scrollRef}
        className="overflow-x-auto"
        onMouseLeave={() => setTooltip(null)}
      >
        <div style={{ width: LABEL_W + chartWidth }}>

          {/* Header row */}
          <div
            className="flex sticky top-0 z-20"
            style={{ height: 52, borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            {/* Sticky label cell */}
            <div
              className="flex-shrink-0 flex items-end pb-1.5 px-4"
              style={{
                width: LABEL_W,
                position: 'sticky', left: 0, zIndex: 30,
                background: 'var(--surface)',
                borderRight: '1px solid var(--border)',
              }}
            >
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                Проект / Этап
              </span>
            </div>

            {/* Timeline header */}
            <div className="relative" style={{ width: chartWidth, height: 52, flexShrink: 0 }}>
              {/* Month labels */}
              <div className="absolute top-0 left-0 flex" style={{ height: 26, width: chartWidth, borderBottom: '1px solid var(--border)' }}>
                {months.map((m, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 px-2 flex items-center text-xs font-medium overflow-hidden"
                    style={{ width: m.days * ppd, borderRight: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Day ticks */}
              <div className="absolute bottom-0 left-0" style={{ height: 26, width: chartWidth }}>
                {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => {
                  const offset = i * 7
                  const tick = new Date(rangeStart)
                  tick.setDate(tick.getDate() + offset)
                  return (
                    <div key={i} className="absolute flex flex-col items-center" style={{ left: offset * ppd }}>
                      <div style={{ width: 1, height: 4, background: 'var(--border-2)' }} />
                      {ppd >= 8 && (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tick.getDate()}</span>
                      )}
                    </div>
                  )
                })}

                {/* Today line in header */}
                {todayPx >= 0 && todayPx <= chartWidth && (
                  <div className="absolute top-0 bottom-0 z-10" style={{ left: todayPx, width: 1, background: 'rgba(248,113,113,0.8)' }}>
                    <span
                      className="absolute left-1 whitespace-nowrap font-semibold"
                      style={{ top: -1, fontSize: 10, color: '#f87171' }}
                    >
                      {formatDate(today)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Empty state after filtering */}
          {visible.length === 0 && (
            <div className="py-16 text-center" style={{ color: 'var(--text-dim)' }}>
              <p className="text-sm">Все проекты скрыты фильтрами</p>
              <button
                className="text-xs mt-2 transition-colors"
                style={{ color: 'var(--text-dim)' }}
                onClick={() => { setHideCompleted(false); setHideCancelled(false); setManagerFilter('all') }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--green)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)' }}
              >
                Сбросить фильтры →
              </button>
            </div>
          )}

          {/* Project rows */}
          {visible.map(project => {
            const projStart = project.start_date ? new Date(project.start_date) : today
            const projEnd   = project.deadline   ? new Date(project.deadline)   : null

            const sortedStages = [...(project.stages ?? [])]
              .filter(s => s.deadline)
              .sort((a, b) => a.order_index - b.order_index)

            return (
              <div key={project.id}>

                {/* Project header */}
                <div className="flex" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <div
                    className="flex-shrink-0 px-4 py-2.5 flex items-center gap-2"
                    style={{
                      width: LABEL_W,
                      position: 'sticky', left: 0, zIndex: 10,
                      background: 'var(--surface-2)',
                      borderRight: '1px solid var(--border)',
                    }}
                  >
                    <span className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--text)' }}>
                      {project.name}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                      style={STATUS_STYLE[project.status]}
                    >
                      {STATUS_LABEL[project.status]}
                    </span>
                  </div>
                  <div className="relative flex-shrink-0" style={{ width: chartWidth, height: 44 }}>
                    <GridLines months={months} ppd={ppd} todayPx={todayPx} chartWidth={chartWidth} />
                    {projEnd && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full"
                        style={{ left: px(projStart), width: Math.max(2, px(projEnd) - px(projStart)), background: 'var(--border-2)' }}
                      />
                    )}
                  </div>
                </div>

                {/* Stage rows */}
                {sortedStages.map((stage, si) => {
                  const base = STAGE_COLORS[si % STAGE_COLORS.length]
                  const stageEnd = new Date(stage.deadline!)
                  const stageStart = stage.start_date
                    ? new Date(stage.start_date)
                    : si === 0 ? projStart : new Date(sortedStages[si - 1].deadline!)

                  const isDone = stage.status === 'done' || stage.status === 'completed'
                  const { color, pulse } = trafficColor(base, stageEnd, today, isDone)

                  const leftPx  = px(stageStart)
                  const widthPx = Math.max(ppd / 2, px(stageEnd) - leftPx)
                  const days    = Math.max(1, dateDiff(stageStart, stageEnd))
                  const diffDays = Math.ceil((stageEnd.getTime() - today.getTime()) / 86400000)

                  return (
                    <div key={stage.id} className="flex" style={{ borderBottom: '1px solid rgba(26,38,32,0.4)' }}>
                      {/* Label */}
                      <div
                        className="flex-shrink-0 flex items-center gap-2 px-4"
                        style={{
                          width: LABEL_W,
                          position: 'sticky', left: 0, zIndex: 10,
                          background: 'var(--surface)',
                          borderRight: '1px solid var(--border)',
                          height: 48, paddingLeft: 28,
                        }}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
                          {stage.name}
                        </span>
                        {stage.assignee && (
                          <span className="text-xs flex-shrink-0 truncate" style={{ color: 'var(--text-dim)', maxWidth: 70 }}>
                            {(Array.isArray(stage.assignee)
                              ? (stage.assignee[0] as { full_name: string } | null)
                              : stage.assignee)?.full_name?.split(' ')[0]}
                          </span>
                        )}
                      </div>

                      {/* Gantt area */}
                      <div className="relative flex-shrink-0" style={{ width: chartWidth, height: 48 }}>
                        <GridLines months={months} ppd={ppd} todayPx={todayPx} chartWidth={chartWidth} />

                        {/* Bar */}
                        <div
                          className={`absolute rounded-lg cursor-pointer${pulse ? ' animate-pulse' : ''}`}
                          style={{
                            left: leftPx,
                            width: widthPx,
                            top: '50%',
                            height: 28,
                            transform: 'translateY(-50%)',
                            background: color + '30',
                            border: `1px solid ${color}70`,
                            transition: 'filter 0.12s',
                          }}
                          onMouseEnter={e => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            ;(e.currentTarget as HTMLElement).style.filter = 'brightness(1.3)'
                            setTooltip({
                              name: stage.name,
                              startDate: stageStart,
                              endDate: stageEnd,
                              days,
                              assignee: (Array.isArray(stage.assignee)
                                ? (stage.assignee[0] as { full_name: string } | null)
                                : stage.assignee)?.full_name ?? null,
                              diffDays,
                              color,
                              screenX: r.left + r.width / 2,
                              screenY: r.top,
                            })
                          }}
                          onMouseLeave={e => {
                            ;(e.currentTarget as HTMLElement).style.filter = 'none'
                          }}
                        />

                        {/* Duration label (center) */}
                        {widthPx > 36 && (
                          <div
                            className="absolute pointer-events-none"
                            style={{ left: leftPx + widthPx / 2, top: '50%', transform: 'translate(-50%, -50%)', zIndex: 5 }}
                          >
                            <span
                              className="text-xs font-bold whitespace-nowrap px-1.5 py-0.5 rounded-md"
                              style={{ color, background: 'var(--bg)', border: `1px solid ${color}55`, lineHeight: 1.4 }}
                            >
                              {days} дн.
                            </span>
                          </div>
                        )}

                        {/* End date (right of bar) */}
                        {ppd >= 8 && (
                          <div
                            className="absolute pointer-events-none"
                            style={{ left: leftPx + widthPx + 4, top: '50%', transform: 'translateY(-50%)', zIndex: 5 }}
                          >
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {formatDate(stageEnd)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Project with no stages */}
                {sortedStages.length === 0 && projEnd && (() => {
                  const days    = Math.max(1, dateDiff(projStart, projEnd))
                  const leftPx  = px(projStart)
                  const widthPx = Math.max(ppd / 2, px(projEnd) - leftPx)
                  return (
                    <div className="flex" style={{ borderBottom: '1px solid rgba(26,38,32,0.4)' }}>
                      <div
                        className="flex-shrink-0 px-4 flex items-center"
                        style={{
                          width: LABEL_W,
                          position: 'sticky', left: 0, zIndex: 10,
                          background: 'var(--surface)',
                          borderRight: '1px solid var(--border)',
                          height: 48, paddingLeft: 28,
                        }}
                      >
                        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Этапы не заданы</span>
                      </div>
                      <div className="relative flex-shrink-0" style={{ width: chartWidth, height: 48 }}>
                        <GridLines months={months} ppd={ppd} todayPx={todayPx} chartWidth={chartWidth} />
                        <div
                          className="absolute rounded-lg"
                          style={{ left: leftPx, width: widthPx, top: '50%', height: 28, transform: 'translateY(-50%)', background: '#22c55e28', border: '1px solid #22c55e55' }}
                        />
                        {widthPx > 36 && (
                          <div
                            className="absolute pointer-events-none"
                            style={{ left: leftPx + widthPx / 2, top: '50%', transform: 'translate(-50%,-50%)', zIndex: 5 }}
                          >
                            <span
                              className="text-xs font-bold whitespace-nowrap px-1.5 py-0.5 rounded-md"
                              style={{ color: '#22c55e', background: 'var(--bg)', border: '1px solid #22c55e55', lineHeight: 1.4 }}
                            >
                              {days} дн.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 px-5 py-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Статус:</span>
        {[
          { color: '#ef4444', label: 'Просрочен' },
          { color: '#fb923c', label: 'Горит (≤1 дня)', pulse: true },
          { color: '#fbbf24', label: 'Скоро (2–3 дня)' },
        ].map(({ color, label, pulse }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className={`w-3 h-3 rounded-sm${pulse ? ' animate-pulse' : ''}`}
              style={{ background: color }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-px h-3" style={{ background: 'rgba(248,113,113,0.7)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Сегодня</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && <Tooltip info={tooltip} onClose={() => setTooltip(null)} />}
    </div>
  )
}
