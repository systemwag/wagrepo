'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createEvent, updateEvent, deleteEvent } from '@/lib/actions/events'
import type { EventImportance } from '@/lib/actions/events'
import {
  ChevronLeft, ChevronRight, Plus, X, MapPin, Clock, Users, Trash2,
  Phone, Handshake, Car, UtensilsCrossed, Wine, MessageSquare, BarChart2, Plane, AlarmClock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import DatePicker from '@/components/ui/DatePicker'
import TimePicker from '@/components/ui/TimePicker'

// ─── Types ────────────────────────────────────────────────────────────────────

type EventRow = {
  id: string
  title: string
  description: string | null
  date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  importance: EventImportance
  created_by: string | null
  event_participants: { user_id: string; profiles: { id: string; full_name: string } | null }[]
}

type Employee = {
  id: string
  full_name: string
  position: string | null
}

type QuickType = { label: string; importance: EventImportance; icon: LucideIcon }

type QuickCreateState = {
  date: string
  title: string
  importance: EventImportance
  selectedType: string | null
  rect: { top: number; left: number; width: number; height: number }
}

type ModalState = {
  mode: 'create' | 'edit'
  prefillDate?: string
  prefillTitle?: string
  prefillImportance?: EventImportance
  event?: EventRow
}

// ─── Constants ────────────────────────────────────────────────────────────────

const IMPORTANCE = {
  low: {
    label:  'Низкая',
    color:  '#93c5fd',
    text:   '#bfdbfe',
    bg:     'rgba(29,78,216,0.28)',
    border: 'rgba(96,165,250,0.45)',
    glow:   'rgba(59,130,246,0.3)',
    dot:    '#3b82f6',
  },
  medium: {
    label:  'Средняя',
    color:  '#fcd34d',
    text:   '#fde68a',
    bg:     'rgba(161,98,7,0.28)',
    border: 'rgba(251,191,36,0.45)',
    glow:   'rgba(245,158,11,0.3)',
    dot:    '#f59e0b',
  },
  high: {
    label:  'Высокая',
    color:  '#fb923c',
    text:   '#fed7aa',
    bg:     'rgba(154,52,18,0.28)',
    border: 'rgba(251,146,60,0.45)',
    glow:   'rgba(249,115,22,0.3)',
    dot:    '#f97316',
  },
  critical: {
    label:  'Срочное',
    color:  '#f87171',
    text:   '#fecaca',
    bg:     'rgba(153,27,27,0.32)',
    border: 'rgba(248,113,113,0.5)',
    glow:   'rgba(239,68,68,0.35)',
    dot:    '#ef4444',
  },
} as const

const QUICK_TYPES: QuickType[] = [
  { label: 'Звонок',        icon: Phone,          importance: 'low'      },
  { label: 'Встреча',       icon: Users,          importance: 'medium'   },
  { label: 'Переговоры',    icon: Handshake,      importance: 'high'     },
  { label: 'Выезд',         icon: Car,            importance: 'medium'   },
  { label: 'Обед',          icon: UtensilsCrossed,importance: 'low'      },
  { label: 'Ужин',          icon: Wine,           importance: 'low'      },
  { label: 'Совещание',     icon: MessageSquare,  importance: 'medium'   },
  { label: 'Презентация',   icon: BarChart2,      importance: 'high'     },
  { label: 'Командировка',  icon: Plane,          importance: 'medium'   },
  { label: 'Дедлайн',       icon: AlarmClock,     importance: 'critical' },
]

const MONTHS      = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MONTHS_GEN  = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
const DAYS        = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

const pad = (n: number) => String(n).padStart(2, '0')

function fmtShort(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)} ${MONTHS_GEN[parseInt(m) - 1]}`
}

// ─── Main Calendar ────────────────────────────────────────────────────────────

export default function EventsCalendar({
  employees,
  isDirector,
}: {
  employees: Employee[]
  isDirector: boolean
}) {
  const today = new Date()
  const [year,    setYear]    = useState(today.getFullYear())
  const [month,   setMonth]   = useState(today.getMonth() + 1)
  const [events,  setEvents]  = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [opacity, setOpacity] = useState(1)

  // Quick-create popover (positioned near the clicked cell)
  const [qc, setQc]           = useState<QuickCreateState | null>(null)
  const [qcSaving, setQcSaving] = useState(false)
  const qcRef = useRef<HTMLDivElement>(null)
  const qcInputRef = useRef<HTMLInputElement>(null)

  // Full detail modal
  const [modal, setModal]     = useState<ModalState | null>(null)

  // Mobile: responsive + selected-day panel
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  )
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Clear day selection on month/year change
  useEffect(() => { setSelectedDay(null) }, [year, month])

  // ─── Data fetching ─────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const from = `${year}-${pad(month)}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${pad(month)}-${pad(lastDay)}`
    const { data } = await supabase
      .from('events')
      .select('*, event_participants(user_id, profiles(id, full_name))')
      .gte('date', from)
      .lte('date', to)
      .order('start_time', { nullsFirst: true })
    setEvents((data as EventRow[]) ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modal) setModal(null)
        else if (qc)  setQc(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modal, qc])

  // Close popover on outside click
  useEffect(() => {
    if (!qc) return
    const onDown = (e: MouseEvent) => {
      if (qcRef.current && !qcRef.current.contains(e.target as Node)) setQc(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [qc])

  // Focus input when popover opens
  useEffect(() => {
    if (qc) setTimeout(() => qcInputRef.current?.focus(), 60)
  }, [!!qc]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Month navigation with fade ──────────────────────────────────────────
  const changeMonth = useCallback((dir: -1 | 1) => {
    setOpacity(0)
    setTimeout(() => {
      setMonth(m => {
        const nm = m + dir
        if (nm < 1)  { setYear(y => y - 1); return 12 }
        if (nm > 12) { setYear(y => y + 1); return 1  }
        return nm
      })
      setOpacity(1)
    }, 140)
  }, [])

  const goToday = () => {
    setOpacity(0)
    setTimeout(() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setOpacity(1) }, 140)
  }

  // ─── Calendar grid ────────────────────────────────────────────────────────
  const firstDow    = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const startOffset = (firstDow + 6) % 7
  const prevMonDays = new Date(year, month - 1, 0).getDate()
  const totalCells  = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, i) => {
    if (i < startOffset)              return { day: prevMonDays - startOffset + i + 1, current: false }
    if (i >= startOffset + daysInMonth) return { day: i - startOffset - daysInMonth + 1, current: false }
    return { day: i - startOffset + 1, current: true }
  })

  const dateStr    = (day: number) => `${year}-${pad(month)}-${pad(day)}`
  const dayEvents  = (day: number) => events.filter(e => e.date === dateStr(day))
  const isWeekend  = (idx: number) => idx % 7 >= 5
  const isTodayFn  = (day: number) =>
    today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day

  // ─── Quick Create ─────────────────────────────────────────────────────────
  function handleCellClick(day: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!isDirector) return
    const rect = e.currentTarget.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pw = 310
    const ph = 280

    let left = rect.left + 4
    let top  = rect.bottom + 6

    if (left + pw > vw - 12) left = rect.right - pw - 4
    if (left < 12)            left = 12
    if (top  + ph > vh - 12) top  = rect.top - ph - 6

    setQc({
      date: dateStr(day),
      title: '',
      importance: 'medium',
      selectedType: null,
      rect: { top, left, width: pw, height: ph },
    })
  }

  function selectQuickType(qt: QuickType) {
    setQc(prev => {
      if (!prev) return prev
      const isDefaultTitle = !prev.title || QUICK_TYPES.some(t => t.label === prev.title)
      return {
        ...prev,
        title:        isDefaultTitle ? qt.label : prev.title,
        importance:   qt.importance,
        selectedType: qt.label,
      }
    })
  }

  async function handleQuickSave() {
    if (!qc || !qc.title.trim()) return
    setQcSaving(true)
    await createEvent({ title: qc.title.trim(), date: qc.date, importance: qc.importance })
    setQcSaving(false)
    setQc(null)
    await fetchEvents()
  }

  function openFullFromQc() {
    if (!qc) return
    setModal({
      mode:             'create',
      prefillDate:      qc.date,
      prefillTitle:     qc.title,
      prefillImportance: qc.importance,
    })
    setQc(null)
  }

  // ─── Full modal helpers ────────────────────────────────────────────────────
  function openCreate() {
    setModal({ mode: 'create', prefillDate: today.toISOString().split('T')[0] })
  }
  function openEdit(ev: EventRow, e: React.MouseEvent) {
    e.stopPropagation()
    setModal({ mode: 'edit', event: ev })
  }
  async function handleModalSaved() { await fetchEvents(); setModal(null) }

  const currentMonthInView = year === today.getFullYear() && month === today.getMonth() + 1

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Мероприятия</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {events.length > 0
              ? `${events.length} ${events.length === 1 ? 'мероприятие' : events.length < 5 ? 'мероприятия' : 'мероприятий'} в этом месяце`
              : 'Планирование событий и встреч компании'
            }
          </p>
        </div>
        {isDirector && (
          <button className="btn-green flex items-center gap-2" onClick={openCreate}>
            <Plus size={15} />
            {isMobile ? 'Создать' : 'Создать мероприятие'}
          </button>
        )}
      </div>

      {/* ── Calendar card ────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">

        {/* Month navigation */}
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <button
            aria-label="Предыдущий месяц"
            onClick={() => changeMonth(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <ChevronLeft size={15} />
          </button>

          <div className="flex-1 text-center">
            <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              {MONTHS[month - 1]}&nbsp;{year}
            </span>
          </div>

          <button
            aria-label="Следующий месяц"
            onClick={() => changeMonth(1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <ChevronRight size={15} />
          </button>

          {!currentMonthInView && (
            <button
              onClick={goToday}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors ml-1"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            >
              Сегодня
            </button>
          )}
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border)' }}>
          {DAYS.map((d, i) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-semibold tracking-widest uppercase"
              style={{
                color: i >= 5 ? 'rgba(248,113,113,0.6)' : 'var(--text-dim)',
                borderRight: i < 6 ? '1px solid var(--border)' : undefined,
                letterSpacing: '0.08em',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div
          role="grid"
          className="grid grid-cols-7"
          style={{ opacity, transition: 'opacity 140ms ease' }}
        >
          {loading
            ? Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    minHeight: 104,
                    borderRight:  (i + 1) % 7 !== 0 ? '1px solid var(--border)' : undefined,
                    borderBottom: i < 28             ? '1px solid var(--border)' : undefined,
                    background: 'rgba(255,255,255,0.01)',
                  }}
                />
              ))
            : cells.map((cell, i) => {
                const evs    = cell.current ? dayEvents(cell.day) : []
                const tod    = cell.current && isTodayFn(cell.day)
                const wknd   = isWeekend(i)
                const ds     = cell.current ? dateStr(cell.day) : undefined
                const isQcDay = isMobile ? selectedDay === cell.day : qc?.date === ds

                const baseBg = !cell.current
                  ? 'rgba(0,0,0,0.16)'
                  : tod   ? 'rgba(34,197,94,0.04)'
                  : wknd  ? 'rgba(0,0,0,0.07)'
                  :         'transparent'

                return (
                  <div
                    key={i}
                    role="gridcell"
                    onClick={e => {
                      if (!cell.current) return
                      if (isMobile) {
                        setSelectedDay(prev => prev === cell.day ? null : cell.day)
                      } else {
                        handleCellClick(cell.day, e)
                      }
                    }}
                    style={{
                      minHeight: isMobile ? 52 : 116,
                      borderRight:  (i + 1) % 7 !== 0 ? '1px solid var(--border)' : undefined,
                      borderBottom: i < totalCells - 7 ? '1px solid var(--border)' : undefined,
                      background: isQcDay ? 'rgba(34,197,94,0.05)' : baseBg,
                      cursor: cell.current && isDirector ? 'pointer' : 'default',
                      position: 'relative',
                      transition: 'background 0.12s',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={e => {
                      if (cell.current && isDirector && !isQcDay)
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = isQcDay ? 'rgba(34,197,94,0.05)' : baseBg
                    }}
                  >
                    {/* Today: top glow stripe */}
                    {tod && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                        background: 'linear-gradient(90deg, var(--green), rgba(34,197,94,0.3))',
                        borderRadius: '0 0 2px 2px',
                      }} />
                    )}

                    {/* Day number row */}
                    <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
                      <span
                        className="w-6 h-6 inline-flex items-center justify-center text-xs rounded-full"
                        style={
                          tod
                            ? { background: 'var(--green)', color: '#040d07', fontWeight: 700 }
                            : {
                                fontWeight: 500,
                                color: !cell.current
                                  ? 'var(--text-dim)'
                                  : wknd
                                  ? 'rgba(248,113,113,0.65)'
                                  : 'var(--text-muted)',
                              }
                        }
                      >
                        {cell.day}
                      </span>

                      {/* Desktop only: "+" hint and event count */}
                      {!isMobile && cell.current && isDirector && evs.length === 0 && (
                        <span
                          className="cell-plus w-4 h-4 rounded flex items-center justify-center text-xs"
                          style={{ opacity: 0, transition: 'opacity 0.15s', color: 'var(--text-dim)', background: 'var(--surface-2)' }}
                        >+</span>
                      )}
                      {!isMobile && cell.current && evs.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--surface-2)', padding: '0 5px', borderRadius: 99 }}>
                          {evs.length}
                        </span>
                      )}
                    </div>

                    {/* ── Mobile: colored dots ── */}
                    {isMobile && evs.length > 0 && (
                      <div className="flex items-center justify-center gap-1 pb-1.5 flex-wrap">
                        {evs.slice(0, 4).map(ev => (
                          <span
                            key={ev.id}
                            className="rounded-full flex-shrink-0"
                            style={{ width: 6, height: 6, background: IMPORTANCE[ev.importance].dot }}
                          />
                        ))}
                        {evs.length > 4 && (
                          <span style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1 }}>+{evs.length - 4}</span>
                        )}
                      </div>
                    )}

                    {/* ── Desktop: full event cards ── */}
                    {!isMobile && (
                      <div className="px-1.5 pb-2 flex flex-col gap-1">
                        {evs.slice(0, 3).map(ev => {
                          const cfg     = IMPORTANCE[ev.importance]
                          const hasTime = !!ev.start_time
                          const pCount  = ev.event_participants?.length ?? 0
                          return (
                            <button
                              key={ev.id}
                              onClick={e => openEdit(ev, e)}
                              title={ev.title}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left',
                                background: cfg.bg, border: `1px solid ${cfg.border}`,
                                borderLeft: `3px solid ${cfg.dot}`, borderRadius: 8,
                                padding: hasTime ? '4px 8px 5px' : '5px 8px',
                                cursor: 'pointer', overflow: 'hidden',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                                transition: 'transform 0.12s, box-shadow 0.12s',
                              }}
                              onMouseEnter={e => {
                                const el = e.currentTarget as HTMLElement
                                el.style.transform = 'translateY(-1px)'
                                el.style.boxShadow = `0 5px 18px ${cfg.glow}, 0 1px 4px rgba(0,0,0,0.3)`
                              }}
                              onMouseLeave={e => {
                                const el = e.currentTarget as HTMLElement
                                el.style.transform = 'translateY(0)'
                                el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.35)'
                              }}
                            >
                              {hasTime && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, letterSpacing: '0.02em' }}>
                                    {ev.start_time!.slice(0, 5)}
                                    {ev.end_time && <span style={{ opacity: 0.6 }}> – {ev.end_time.slice(0, 5)}</span>}
                                  </span>
                                  {pCount > 0 && <span style={{ fontSize: 10, color: cfg.color, opacity: 0.6 }}>{pCount} уч.</span>}
                                </div>
                              )}
                              <div style={{ fontSize: 11.5, fontWeight: 500, color: cfg.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.35 }}>
                                {ev.title}
                              </div>
                              {!hasTime && (ev.location || pCount > 0) && (
                                <div style={{ marginTop: 2, fontSize: 10, color: cfg.color, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ev.location ?? `${pCount} уч.`}
                                </div>
                              )}
                            </button>
                          )
                        })}
                        {evs.length > 3 && (
                          <div className="text-xs px-2 py-1 rounded-lg text-center" style={{ color: 'var(--text-dim)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                            +{evs.length - 3} ещё
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
          }
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3.5">
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Важность:</span>
        {(Object.entries(IMPORTANCE) as [EventImportance, (typeof IMPORTANCE)[EventImportance]][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
          </div>
        ))}
        {isDirector && (
          <span className="text-xs ml-auto hidden sm:block" style={{ color: 'var(--text-dim)' }}>
            Нажмите на день для быстрого создания · Esc для закрытия
          </span>
        )}
      </div>

      {/* ── Mobile: selected-day panel ───────────────────────────────────── */}
      {isMobile && selectedDay !== null && (
        <div
          className="mt-4 card overflow-hidden"
          style={{ animation: 'qcFadeIn 0.18s ease' }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {selectedDay} {MONTHS_GEN[month - 1]}
              {isTodayFn(selectedDay) && (
                <span
                  className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--green)' }}
                >
                  Сегодня
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {isDirector && (
                <button
                  onClick={() => {
                    setModal({
                      mode: 'create',
                      prefillDate: dateStr(selectedDay),
                    })
                    setSelectedDay(null)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium btn-green"
                >
                  <Plus size={13} />
                  Добавить
                </button>
              )}
              <button
                onClick={() => setSelectedDay(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--text-dim)' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Events list */}
          {dayEvents(selectedDay).length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Мероприятий нет</p>
              {isDirector && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)', opacity: 0.6 }}>
                  Нажмите «Добавить» чтобы создать
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {dayEvents(selectedDay).map(ev => {
                const cfg = IMPORTANCE[ev.importance]
                const pCount = ev.event_participants?.length ?? 0
                return (
                  <button
                    key={ev.id}
                    onClick={() => isDirector && setModal({ mode: 'edit', event: ev })}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                    style={{ cursor: isDirector ? 'pointer' : 'default' }}
                    onMouseEnter={e => {
                      if (isDirector)
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    {/* Importance stripe */}
                    <div
                      className="w-1 rounded-full flex-shrink-0 mt-0.5"
                      style={{ background: cfg.dot, minHeight: 36, alignSelf: 'stretch' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="font-medium text-sm truncate"
                          style={{ color: 'var(--text)' }}
                        >
                          {ev.title}
                        </span>
                        <span
                          className="text-xs flex-shrink-0 px-1.5 py-0.5 rounded-md"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {(ev.start_time || ev.end_time) && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <Clock size={11} />
                            {ev.start_time?.slice(0, 5)}
                            {ev.end_time && <span>– {ev.end_time.slice(0, 5)}</span>}
                          </span>
                        )}
                        {ev.location && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <MapPin size={11} />
                            {ev.location}
                          </span>
                        )}
                        {pCount > 0 && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <Users size={11} />
                            {pCount} уч.
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Quick-create popover ──────────────────────────────────────────── */}
      {qc && (
        <div
          ref={qcRef}
          style={{
            position: 'fixed',
            top:    qc.rect.top,
            left:   qc.rect.left,
            width:  qc.rect.width,
            zIndex: 60,
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            animation: 'qcFadeIn 0.15s ease',
          }}
        >
          {/* Date header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {fmtShort(qc.date)}
            </span>
            <button
              onClick={() => setQc(null)}
              className="w-5 h-5 flex items-center justify-center rounded"
              style={{ color: 'var(--text-dim)' }}
            >
              <X size={12} />
            </button>
          </div>

          <div className="px-4 py-3 flex flex-col gap-3">
            {/* Quick type grid — 5 cols × 2 rows, icons only */}
            <div className="grid grid-cols-5 gap-1.5">
              {QUICK_TYPES.map(qt => {
                const cfg  = IMPORTANCE[qt.importance]
                const sel  = qc.selectedType === qt.label
                const Icon = qt.icon
                return (
                  <button
                    key={qt.label}
                    type="button"
                    onClick={() => selectQuickType(qt)}
                    title={qt.label}
                    className="flex items-center justify-center rounded-xl transition-all"
                    style={{
                      height: 44,
                      background: sel ? cfg.bg    : 'var(--surface-2)',
                      color:      sel ? cfg.color : 'var(--text-dim)',
                      border:     `1px solid ${sel ? cfg.border : 'transparent'}`,
                      boxShadow:  sel ? `0 0 10px ${cfg.glow}` : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!sel) {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'var(--border)'
                        el.style.color = 'var(--text)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!sel) {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'var(--surface-2)'
                        el.style.color = 'var(--text-dim)'
                      }
                    }}
                  >
                    <Icon size={18} strokeWidth={1.7} />
                  </button>
                )
              })}
            </div>

            {/* Selected type label */}
            {qc.selectedType && (
              <div
                className="text-center text-xs font-medium -mt-1"
                style={{ color: IMPORTANCE[qc.importance].color }}
              >
                {qc.selectedType}
              </div>
            )}

            {/* Title input */}
            <input
              ref={qcInputRef}
              className="input"
              style={{ fontSize: 13 }}
              placeholder="Название мероприятия..."
              value={qc.title}
              onChange={e => setQc(prev => prev ? { ...prev, title: e.target.value } : prev)}
              onKeyDown={e => {
                if (e.key === 'Enter' && qc.title.trim()) handleQuickSave()
              }}
            />

            {/* Importance bar */}
            <div className="flex gap-1">
              {(Object.entries(IMPORTANCE) as [EventImportance, (typeof IMPORTANCE)[EventImportance]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setQc(prev => prev ? { ...prev, importance: key, selectedType: null } : prev)}
                  className="flex-1 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: qc.importance === key ? cfg.bg     : 'var(--surface-2)',
                    color:      qc.importance === key ? cfg.color  : 'var(--text-dim)',
                    border:     `1px solid ${qc.importance === key ? cfg.border : 'transparent'}`,
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openFullFromQc}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                Подробнее
              </button>
              <button
                type="button"
                disabled={!qc.title.trim() || qcSaving}
                onClick={handleQuickSave}
                className="flex-1 btn-green text-xs py-2"
              >
                {qcSaving ? '...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full detail modal ─────────────────────────────────────────────── */}
      {modal && (
        <EventModal
          mode={modal.mode}
          prefillDate={modal.prefillDate}
          prefillTitle={modal.prefillTitle}
          prefillImportance={modal.prefillImportance}
          event={modal.event}
          employees={employees}
          onClose={() => setModal(null)}
          onSaved={handleModalSaved}
        />
      )}

      {/* Popover animation */}
      <style>{`
        @keyframes qcFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        [role="gridcell"]:hover .cell-plus { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

// ─── Full Event Modal ─────────────────────────────────────────────────────────

function EventModal({
  mode,
  prefillDate,
  prefillTitle,
  prefillImportance,
  event,
  employees,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  prefillDate?: string
  prefillTitle?: string
  prefillImportance?: EventImportance
  event?: EventRow
  employees: Employee[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const todayStr = new Date().toISOString().split('T')[0]

  const [title,          setTitle]          = useState(event?.title ?? prefillTitle ?? '')
  const [date,           setDate]           = useState(event?.date  ?? prefillDate  ?? todayStr)
  const [startTime,      setStartTime]      = useState(event?.start_time?.slice(0, 5) ?? '')
  const [endTime,        setEndTime]        = useState(event?.end_time?.slice(0, 5)   ?? '')
  const [importance,     setImportance]     = useState<EventImportance>(
    event?.importance ?? prefillImportance ?? 'medium'
  )
  const [location,       setLocation]       = useState(event?.location    ?? '')
  const [description,    setDescription]    = useState(event?.description ?? '')
  const [participantIds, setParticipantIds] = useState<string[]>(
    event?.event_participants.map(p => p.user_id) ?? []
  )
  const [search,         setSearch]         = useState('')
  const [saving,         setSaving]         = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [confirmDel,     setConfirmDel]     = useState(false)
  const [error,          setError]          = useState('')

  // Track what quick-type label was last applied (to allow re-applying)
  const [activeType, setActiveType] = useState<string | null>(
    prefillTitle ? QUICK_TYPES.find(t => t.label === prefillTitle)?.label ?? null : null
  )

  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const toggleParticipant = (id: string) =>
    setParticipantIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])

  function applyQuickType(qt: QuickType) {
    const isDefault = !title || QUICK_TYPES.some(t => t.label === title)
    if (isDefault) setTitle(qt.label)
    setImportance(qt.importance)
    setActiveType(qt.label)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError('')

    const payload = {
      title:          title.trim(),
      description:    description.trim() || undefined,
      date,
      start_time:     startTime || undefined,
      end_time:       endTime   || undefined,
      location:       location.trim() || undefined,
      importance,
      participant_ids: participantIds,
    }

    const res = mode === 'create'
      ? await createEvent(payload)
      : await updateEvent(event!.id, payload)

    if ('error' in res && res.error) { setError(res.error); setSaving(false); return }
    setSaving(false)
    await onSaved()
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    await deleteEvent(event!.id)
    setDeleting(false)
    await onSaved()
  }

  const cfg = IMPORTANCE[importance]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg flex flex-col"
        style={{
          background: 'var(--surface)',
          maxHeight: '92vh',
          animation: 'modalIn 0.18s cubic-bezier(0.34,1.4,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {/* Importance accent bar */}
          <div
            className="w-1 h-7 rounded-full flex-shrink-0"
            style={{ background: cfg.color, transition: 'background 0.2s' }}
          />
          <h3 className="font-semibold text-base flex-1" style={{ color: 'var(--text)' }}>
            {mode === 'create' ? 'Новое мероприятие' : 'Редактировать мероприятие'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex flex-col">
          <div className="px-6 py-5 flex flex-col gap-5">

            {/* ── Quick types ──────────────────────────────────────────── */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-dim)' }}>
                Быстрый выбор типа
              </p>
              <div className="grid grid-cols-5 gap-2">
                {QUICK_TYPES.map(qt => {
                  const c    = IMPORTANCE[qt.importance]
                  const sel  = activeType === qt.label
                  const Icon = qt.icon
                  return (
                    <button
                      key={qt.label}
                      type="button"
                      onClick={() => applyQuickType(qt)}
                      title={qt.label}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                      style={{
                        background: sel ? c.bg    : 'var(--surface-2)',
                        color:      sel ? c.color : 'var(--text-dim)',
                        border:     `1px solid ${sel ? c.border : 'var(--border-2)'}`,
                        boxShadow:  sel ? `0 0 12px ${c.glow}` : 'none',
                      }}
                      onMouseEnter={e => {
                        if (!sel) {
                          const el = e.currentTarget as HTMLElement
                          el.style.background = 'var(--border)'
                          el.style.color = 'var(--text)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!sel) {
                          const el = e.currentTarget as HTMLElement
                          el.style.background = 'var(--surface-2)'
                          el.style.color = 'var(--text-dim)'
                        }
                      }}
                    >
                      <Icon size={18} strokeWidth={1.6} />
                      <span style={{ fontSize: 10, fontWeight: 500, lineHeight: 1 }}>{qt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', margin: '-8px 0' }} />

            {/* ── Title ────────────────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Название *
              </label>
              <input
                className="input"
                value={title}
                onChange={e => { setTitle(e.target.value); setActiveType(null) }}
                placeholder="Название мероприятия"
                required
                autoFocus
              />
            </div>

            {/* ── Importance ───────────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Важность
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(IMPORTANCE) as [EventImportance, (typeof IMPORTANCE)[EventImportance]][]).map(([key, c]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setImportance(key); setActiveType(null) }}
                    className="py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: importance === key ? c.bg    : 'var(--surface-2)',
                      color:      importance === key ? c.color : 'var(--text-dim)',
                      border:     `1px solid ${importance === key ? c.border : 'var(--border-2)'}`,
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Date ─────────────────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Дата *
              </label>
              <DatePicker value={date} onChange={setDate} placeholder="Выберите дату" />
            </div>

            {/* ── Time ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  <Clock size={10} className="inline mr-1" />Начало
                </label>
                <TimePicker value={startTime} onChange={setStartTime} placeholder="--:--" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  <Clock size={10} className="inline mr-1" />Окончание
                </label>
                <TimePicker value={endTime} onChange={setEndTime} placeholder="--:--" />
              </div>
            </div>

            {/* ── Location ─────────────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                <MapPin size={10} className="inline mr-1" />Место проведения
              </label>
              <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Адрес или название" />
            </div>

            {/* ── Description ──────────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Описание
              </label>
              <textarea
                className="input resize-none"
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Краткое описание..."
              />
            </div>

            {/* ── Participants ──────────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                <Users size={10} className="inline mr-1" />
                Участники
                {participantIds.length > 0 && (
                  <span
                    className="ml-2 px-1.5 py-0.5 rounded-full text-xs"
                    style={{ background: 'var(--green-glow)', color: 'var(--green)' }}
                  >
                    {participantIds.length}
                  </span>
                )}
              </label>
              <input
                className="input mb-2"
                style={{ fontSize: 12 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Найти сотрудника..."
              />
              <div
                className="rounded-xl overflow-hidden overflow-y-auto"
                style={{ border: '1px solid var(--border-2)', maxHeight: 180 }}
              >
                {filtered.map((emp, i) => {
                  const sel = participantIds.includes(emp.id)
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleParticipant(emp.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                      style={{
                        background:   sel ? 'var(--green-glow)' : 'transparent',
                        borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : undefined,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                      onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <div
                        className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                        style={{
                          border:     `1.5px solid ${sel ? 'var(--green)' : 'var(--border-2)'}`,
                          background: sel ? 'var(--green)' : 'transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        {sel && (
                          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                            <path d="M1 3.5L3.2 5.5L8 1" stroke="#040d07" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div
                        className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{
                          background: sel ? 'rgba(34,197,94,0.2)' : 'var(--surface-2)',
                          color:      sel ? 'var(--green)' : 'var(--text-muted)',
                        }}
                      >
                        {emp.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ color: sel ? 'var(--green)' : 'var(--text)' }}>
                          {emp.full_name}
                        </p>
                        {emp.position && (
                          <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{emp.position}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
                {filtered.length === 0 && (
                  <div className="px-3 py-5 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    Не найдено
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-xs text-center" style={{ color: '#f87171' }}>{error}</p>}
          </div>

          {/* Footer */}
          <div
            className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {mode === 'edit' && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  color:      confirmDel ? '#f87171' : 'var(--text-muted)',
                  border:     `1px solid ${confirmDel ? 'rgba(239,68,68,0.4)' : 'var(--border-2)'}`,
                  background: confirmDel ? 'rgba(239,68,68,0.08)' : 'transparent',
                }}
                onMouseEnter={e => { if (!confirmDel) (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                onMouseLeave={e => { if (!confirmDel) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
              >
                <Trash2 size={13} />
                {deleting ? 'Удаление...' : confirmDel ? 'Точно удалить?' : 'Удалить'}
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              Отмена
            </button>
            <button type="submit" disabled={saving || !title.trim()} className="btn-green">
              {saving ? 'Сохранение...' : mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </div>
  )
}
