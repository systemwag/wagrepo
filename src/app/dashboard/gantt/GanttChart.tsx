'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ZoomIn, ZoomOut, Crosshair, Filter, ChevronDown, X, Calendar, User, Clock, AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Stage = {
  id: string
  name: string
  order_index: number
  status: string | null
  start_date: string | null
  deadline: string | null
  assignee_name: string | null
  total_tasks: number
  done_tasks:  number
}

export type Project = {
  id: string
  name: string
  status: string
  start_date: string | null
  deadline: string | null
  client_name: string | null
  manager_name: string | null
  stages: Stage[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LABEL_W = 264
const MOBILE_LABEL_W = 104

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

const FROST: React.CSSProperties = { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active:    { background: 'rgba(34,197,94,0.12)',  color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', ...FROST },
  on_hold:   { background: 'rgba(234,179,8,0.1)',   color: '#ca8a04', border: '1px solid rgba(234,179,8,0.2)', ...FROST },
  completed: { background: 'rgba(96,165,250,0.1)',  color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)', ...FROST },
  cancelled: { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', ...FROST },
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
  months, ppd, todayPx, chartWidth, weekendBg,
}: {
  months: { days: number }[]
  ppd: number
  todayPx: number
  chartWidth: number
  weekendBg?: React.CSSProperties
}) {
  return (
    <>
      {/* Штриховка выходных — один cheap repeating-gradient на строку */}
      {weekendBg && <div className="absolute inset-0 pointer-events-none" style={weekendBg} />}
      {/* Колонны месяцев + лёгкая зебра */}
      <div className="absolute inset-0 flex pointer-events-none overflow-hidden">
        {months.map((m, i) => (
          <div
            key={i}
            className="flex-shrink-0 h-full"
            style={{
              width: m.days * ppd,
              borderRight: '1px solid rgba(26,38,32,0.3)',
              background: i % 2 ? 'color-mix(in oklab, var(--color-text) 1.6%, transparent)' : 'transparent',
            }}
          />
        ))}
      </div>
      {todayPx >= 0 && todayPx <= chartWidth && (
        <div className="gantt-today-beam" style={{ left: todayPx }} />
      )}
    </>
  )
}

function Tooltip({ info }: { info: TooltipData }) {
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

  // Mobile
  const [isMobile, setIsMobile] = useState(false)
  const [mobileTab, setMobileTab] = useState<'list' | 'chart'>('list')
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  // Штриховка выходных — только на крупных зумах (Месяц/Неделя), иначе
  // бэндом в 2 пикселя её всё равно не видно. Выходные повторяются каждые
  // 7 дней, поэтому один repeating-linear-gradient со сдвигом до первой
  // субботы покрывает всю строку без лишнего DOM.
  const weekendBg: React.CSSProperties | undefined = useMemo(() => {
    if (ppd < 20) return undefined
    const satOffset = (6 - rangeStart.getDay() + 7) % 7
    const shade = 'color-mix(in oklab, var(--color-text) 3%, transparent)'
    return {
      backgroundImage: `repeating-linear-gradient(90deg, ${shade} 0, ${shade} ${2 * ppd}px, transparent ${2 * ppd}px, transparent ${7 * ppd}px)`,
      backgroundPositionX: `${satOffset * ppd}px`,
    }
  }, [ppd, rangeStart])

  const labelW = isMobile ? MOBILE_LABEL_W : LABEL_W

  // ── Auto-scroll to today ──
  useEffect(() => {
    if (!scrollRef.current) return
    const cw = scrollRef.current.clientWidth - labelW
    scrollRef.current.scrollLeft = Math.max(0, todayPx - cw / 2)
  }, [todayPx, ppd, labelW])

  // ── Managers list for filter ──
  const managers = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    projects.forEach(p => {
      if (p.manager_name && !seen.has(p.manager_name)) {
        seen.add(p.manager_name)
        list.push(p.manager_name)
      }
    })
    return list
  }, [projects])

  // ── Filtered projects ──
  const visible = useMemo(() => projects.filter(p => {
    if (hideCompleted && p.status === 'completed') return false
    if (hideCancelled && p.status === 'cancelled') return false
    if (managerFilter !== 'all' && p.manager_name !== managerFilter) return false
    return true
  }), [projects, hideCompleted, hideCancelled, managerFilter])

  // Сколько этапов без даты в видимых проектах — для warning-баннера
  const stagesWithoutDeadline = useMemo(() => {
    let n = 0
    for (const p of visible) for (const s of p.stages ?? []) if (!s.deadline) n++
    return n
  }, [visible])

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
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, color-mix(in oklab, var(--color-text) 3%, var(--surface-2)), var(--surface-2))',
        }}
      >
        {/* Mobile tab switcher */}
        {isMobile && (
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {(['list', 'chart'] as const).map((tab, i) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className="px-3 py-1 text-xs font-semibold"
                style={{
                  background: mobileTab === tab ? 'var(--green-glow)' : 'var(--surface)',
                  color: mobileTab === tab ? 'var(--green)' : 'var(--text-dim)',
                  borderRight: i === 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                {tab === 'list' ? 'Список' : 'График'}
              </button>
            ))}
          </div>
        )}

        {/* Zoom buttons */}
        <div className={`flex items-center gap-1${isMobile && mobileTab === 'list' ? ' hidden' : ''}`}>
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
            const cw = scrollRef.current.clientWidth - labelW
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

      {/* ── Warning: этапы без deadline ── */}
      {stagesWithoutDeadline > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs"
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'color-mix(in oklab, #f59e0b 8%, transparent)',
            color: '#f59e0b',
          }}
        >
          <AlertCircle size={13} />
          <span>
            {stagesWithoutDeadline} {stagesWithoutDeadline === 1 ? 'этап без даты' : stagesWithoutDeadline < 5 ? 'этапа без дат' : 'этапов без дат'}
            {' — '}<span style={{ color: 'var(--text-muted)' }}>добавьте срок выполнения, чтобы они отобразились на шкале</span>
          </span>
        </div>
      )}

      {/* ── Mobile list view ── */}
      {isMobile && mobileTab === 'list' && (
        <div className="flex flex-col" style={{ borderTop: '1px solid var(--border)' }}>
          {visible.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Все проекты скрыты фильтрами</p>
              <button
                className="text-xs mt-2"
                style={{ color: 'var(--text-dim)' }}
                onClick={() => { setHideCompleted(false); setHideCancelled(false); setManagerFilter('all') }}
              >
                Сбросить фильтры →
              </button>
            </div>
          )}
          {visible.map(project => {
            const projStart = project.start_date ? new Date(project.start_date) : today
            const allStages = [...(project.stages ?? [])].sort((a, b) => a.order_index - b.order_index)
            // Для fallback start_date «следующий после предыдущего deadline» нужна цепочка
            // только датированных этапов в правильном порядке.
            const datedStages = allStages.filter(s => s.deadline)
            return (
              <div key={project.id} style={{ borderBottom: '1px solid var(--border)' }}>
                {/* Project header — кликабельный */}
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="px-4 py-3 flex items-center justify-between gap-2 hover-surface"
                  style={{ background: 'var(--surface-2)' }}
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
                </Link>
                {/* Stage rows */}
                {allStages.map(stage => {
                  const si = datedStages.findIndex(s => s.id === stage.id)
                  const base = STAGE_COLORS[Math.max(0, si) % STAGE_COLORS.length]
                  const isDone = stage.status === 'done' || stage.status === 'completed'

                  // Этап без даты — особая отрисовка
                  if (!stage.deadline) {
                    return (
                      <Link
                        key={stage.id}
                        href={`/dashboard/projects/${project.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover-surface"
                        style={{ borderTop: '1px solid rgba(26,38,32,0.3)', paddingLeft: 24 }}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--text-dim)', opacity: 0.5 }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-muted)' }}>
                            {stage.name}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                            Дата не задана
                          </p>
                        </div>
                      </Link>
                    )
                  }

                  const stageEnd = new Date(stage.deadline)
                  const { color, pulse } = trafficColor(base, stageEnd, today, isDone)
                  const diffDays = Math.ceil((stageEnd.getTime() - today.getTime()) / 86400000)
                  const prevDated = si > 0 ? datedStages[si - 1] : null
                  const stageStart = stage.start_date
                    ? new Date(stage.start_date)
                    : prevDated ? new Date(prevDated.deadline!) : projStart
                  let diffLabel = `${diffDays} дн.`
                  let diffColor = 'var(--text-dim)'
                  if (diffDays < 0) { diffLabel = `${Math.abs(diffDays)} дн. назад`; diffColor = '#ef4444' }
                  else if (diffDays === 0) { diffLabel = 'Сегодня'; diffColor = '#fb923c' }
                  else if (diffDays === 1) { diffLabel = 'Завтра'; diffColor = '#fb923c' }
                  else if (diffDays <= 3) { diffColor = '#fbbf24' }
                  return (
                    <Link
                      key={stage.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover-surface"
                      style={{ borderTop: '1px solid rgba(26,38,32,0.3)', paddingLeft: 24 }}
                    >
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0${pulse ? ' animate-pulse' : ''}`}
                        style={{ background: color, boxShadow: `0 0 6px ${color}aa` }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-muted)' }}>
                          {stage.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                          {formatDate(stageStart)} → {formatDate(stageEnd)}
                          {stage.assignee_name && (
                            <span className="ml-2">{stage.assignee_name.split(' ')[0]}</span>
                          )}
                          {stage.total_tasks > 0 && (
                            <span className="ml-2">· {stage.done_tasks}/{stage.total_tasks}</span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: diffColor }}>
                        {diffLabel}
                      </span>
                    </Link>
                  )
                })}
                {allStages.length === 0 && (
                  <div className="px-6 py-3" style={{ borderTop: '1px solid rgba(26,38,32,0.3)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Этапы не заданы</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Chart ── */}
      {(!isMobile || mobileTab === 'chart') && (
      <div
        ref={scrollRef}
        className="overflow-x-auto"
        onMouseLeave={() => setTooltip(null)}
      >
        <div style={{ width: labelW + chartWidth }}>

          {/* Header row */}
          <div
            className="flex sticky top-0 z-20"
            style={{ height: 52, borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            {/* Sticky label cell */}
            <div
              className="flex-shrink-0 flex items-end pb-1.5 px-4"
              style={{
                width: labelW,
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

                {/* Today line in header — луч со свечением, ромб и подпись */}
                {todayPx >= 0 && todayPx <= chartWidth && (
                  <div className="gantt-today-head" style={{ left: todayPx }}>
                    <span className="gantt-today-label">{formatDate(today)}</span>
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
          {visible.map((project, pIdx) => {
            const projStart = project.start_date ? new Date(project.start_date) : today
            const projEnd   = project.deadline   ? new Date(project.deadline)   : null

            const allStages = [...(project.stages ?? [])].sort((a, b) => a.order_index - b.order_index)
            const datedStages = allStages.filter(s => s.deadline)

            return (
              <div key={project.id}>

                {/* Project header (clickable) */}
                <div className="flex" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="flex-shrink-0 px-4 py-2.5 flex items-center gap-2 hover-surface"
                    style={{
                      width: labelW,
                      position: 'sticky', left: 0, zIndex: 10,
                      background: 'var(--surface-2)',
                      borderRight: '1px solid var(--border)',
                    }}
                  >
                    <span className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--text)' }}>
                      {project.name}
                    </span>
                    {!isMobile && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                        style={STATUS_STYLE[project.status]}
                      >
                        {STATUS_LABEL[project.status]}
                      </span>
                    )}
                  </Link>
                  <div className="relative flex-shrink-0" style={{ width: chartWidth, height: 44 }}>
                    <GridLines months={months} ppd={ppd} todayPx={todayPx} chartWidth={chartWidth} weekendBg={weekendBg} />
                    {projEnd && (
                      <>
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded-full"
                          style={{
                            left: px(projStart),
                            width: Math.max(2, px(projEnd) - px(projStart)),
                            height: 3,
                            background: 'linear-gradient(90deg, color-mix(in oklab, var(--color-text) 12%, transparent), color-mix(in oklab, var(--color-text) 26%, transparent))',
                          }}
                        />
                        <div className="gantt-milestone" style={{ left: px(projEnd) }} title="Дедлайн проекта" />
                      </>
                    )}
                  </div>
                </div>

                {/* Stage rows */}
                {allStages.map(stage => {
                  const si = datedStages.findIndex(s => s.id === stage.id)
                  const base = STAGE_COLORS[Math.max(0, si) % STAGE_COLORS.length]
                  const isDone = stage.status === 'done' || stage.status === 'completed'

                  // Этап без даты — отдельная строка с серой штриховой полосой
                  if (!stage.deadline) {
                    return (
                      <div key={stage.id} className="flex" style={{ borderBottom: '1px solid rgba(26,38,32,0.4)' }}>
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="flex-shrink-0 flex items-center gap-2 hover-surface"
                          style={{
                            width: labelW,
                            position: 'sticky', left: 0, zIndex: 10,
                            background: 'var(--surface)',
                            borderRight: '1px solid var(--border)',
                            height: 48, paddingLeft: isMobile ? 12 : 28, paddingRight: 8,
                          }}
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--text-dim)', opacity: 0.5 }} />
                          <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
                            {stage.name}
                          </span>
                          {stage.assignee_name && !isMobile && (
                            <span className="text-xs flex-shrink-0 truncate" style={{ color: 'var(--text-dim)', maxWidth: 70 }}>
                              {stage.assignee_name.split(' ')[0]}
                            </span>
                          )}
                        </Link>
                        <div className="relative flex-shrink-0" style={{ width: chartWidth, height: 48 }}>
                          <GridLines months={months} ppd={ppd} todayPx={todayPx} chartWidth={chartWidth} weekendBg={weekendBg} />
                          {/* Подсказка о пропущенной дате — серая полоса с штриховкой по всей доступной ширине */}
                          <div
                            className="absolute pointer-events-none"
                            style={{
                              left: 8, right: 8,
                              top: '50%', transform: 'translateY(-50%)',
                              height: 12,
                              borderRadius: 4,
                              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 6px, transparent 6px 12px)',
                              border: '1px dashed var(--border-2)',
                            }}
                          />
                          <span
                            className="absolute pointer-events-none text-xs italic"
                            style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
                          >
                            Дата не задана
                          </span>
                        </div>
                      </div>
                    )
                  }

                  const stageEnd = new Date(stage.deadline)
                  const prevDated = si > 0 ? datedStages[si - 1] : null
                  const stageStart = stage.start_date
                    ? new Date(stage.start_date)
                    : prevDated ? new Date(prevDated.deadline!) : projStart

                  const { color, pulse } = trafficColor(base, stageEnd, today, isDone)

                  const leftPx  = px(stageStart)
                  const widthPx = Math.max(ppd / 2, px(stageEnd) - leftPx)
                  const days    = Math.max(1, dateDiff(stageStart, stageEnd))
                  const diffDays = Math.ceil((stageEnd.getTime() - today.getTime()) / 86400000)

                  // Прогресс этапа: % выполненных задач. Если задач нет — оцениваем по статусу.
                  const progressPct = stage.total_tasks > 0
                    ? Math.round((stage.done_tasks / stage.total_tasks) * 100)
                    : (isDone ? 100 : stage.status === 'in_progress' ? 50 : 0)

                  return (
                    <div key={stage.id} className="flex" style={{ borderBottom: '1px solid rgba(26,38,32,0.4)' }}>
                      {/* Label (clickable) */}
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="flex-shrink-0 flex items-center gap-2 hover-surface"
                        style={{
                          width: labelW,
                          position: 'sticky', left: 0, zIndex: 10,
                          background: 'var(--surface)',
                          borderRight: '1px solid var(--border)',
                          height: 48, paddingLeft: isMobile ? 12 : 28, paddingRight: 8,
                        }}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}aa` }} />
                        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
                          {stage.name}
                        </span>
                        {stage.assignee_name && !isMobile && (
                          <span className="text-xs flex-shrink-0 truncate" style={{ color: 'var(--text-dim)', maxWidth: 70 }}>
                            {stage.assignee_name.split(' ')[0]}
                          </span>
                        )}
                      </Link>

                      {/* Gantt area */}
                      <div className="relative flex-shrink-0" style={{ width: chartWidth, height: 48 }}>
                        <GridLines months={months} ppd={ppd} todayPx={todayPx} chartWidth={chartWidth} weekendBg={weekendBg} />

                        {/* Bar wrapped in Link (клик → проект) */}
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          aria-label={`${project.name}: ${stage.name}`}
                          className={
                            'gantt-bar gantt-animate-in' +
                            (pulse ? ' animate-pulse' : '') +
                            (diffDays < 0 && !isDone ? ' gantt-bar--overdue' : '') +
                            (!isDone && stage.status === 'in_progress' ? ' gantt-bar--active' : '')
                          }
                          style={{
                            left: leftPx,
                            width: widthPx,
                            top: 10,
                            ['--bar-color' as string]: color,
                            animationDelay: `${Math.min(pIdx * 50 + Math.max(0, si) * 45, 700)}ms`,
                          } as React.CSSProperties}
                          onMouseEnter={e => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            ;(e.currentTarget as HTMLElement).style.filter = 'brightness(1.18)'
                            setTooltip({
                              name: stage.name,
                              startDate: stageStart,
                              endDate: stageEnd,
                              days,
                              assignee: stage.assignee_name,
                              diffDays,
                              color,
                              screenX: r.left + r.width / 2,
                              screenY: r.top,
                            })
                          }}
                          onMouseLeave={e => {
                            ;(e.currentTarget as HTMLElement).style.filter = 'none'
                          }}
                        >
                          {/* Прогресс-заливка со светящимся фронтом */}
                          {progressPct > 0 && (
                            <div className="gantt-progress" style={{ width: `${progressPct}%` }} />
                          )}
                        </Link>

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
                {allStages.length === 0 && projEnd && (() => {
                  const days    = Math.max(1, dateDiff(projStart, projEnd))
                  const leftPx  = px(projStart)
                  const widthPx = Math.max(ppd / 2, px(projEnd) - leftPx)
                  return (
                    <div className="flex" style={{ borderBottom: '1px solid rgba(26,38,32,0.4)' }}>
                      <div
                        className="flex-shrink-0 px-4 flex items-center"
                        style={{
                          width: labelW,
                          position: 'sticky', left: 0, zIndex: 10,
                          background: 'var(--surface)',
                          borderRight: '1px solid var(--border)',
                          height: 48, paddingLeft: isMobile ? 12 : 28,
                        }}
                      >
                        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Этапы не заданы</span>
                      </div>
                      <div className="relative flex-shrink-0" style={{ width: chartWidth, height: 48 }}>
                        <GridLines months={months} ppd={ppd} todayPx={todayPx} chartWidth={chartWidth} weekendBg={weekendBg} />
                        <div
                          className="gantt-bar gantt-animate-in"
                          style={{ left: leftPx, width: widthPx, top: 10, ['--bar-color' as string]: '#22c55e' } as React.CSSProperties}
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
      )}

      {/* ── Legend ── */}
      {(!isMobile || mobileTab === 'chart') && (
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
      )}

      {/* Tooltip */}
      {tooltip && <Tooltip info={tooltip} />}
    </div>
  )
}
