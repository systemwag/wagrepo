'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle, ChevronRight, ChevronDown, Check, Moon, ArrowDown, Inbox,
} from 'lucide-react'
import { toggleDailyReaction } from '@/lib/actions/daily'
import { findWorkload, DAILY_REACTIONS } from '@/lib/constants/workload'
import JournalFilters from './JournalFilters'
import JournalHeatmap, { type DayStat } from './JournalHeatmap'

// ── Типы ─────────────────────────────────────────────────────────────────────
type ReportTask = {
  id: string
  direct_task_id:  string | null
  project_task_id: string | null
  stage_id:        string | null
  task_title:      string
  hours_spent:     number
  is_completed:    boolean
}
type Reaction = { emoji: string; profile_id: string }
type DailyReport = {
  id: string; report_date: string; did_today: string; plan_tomorrow: string | null
  has_blocker: boolean; blocker_text: string | null; workload: number | null
  created_at: string
  report_tasks: ReportTask[]
  reactions: Reaction[]
}
export type JournalMember = {
  id: string; full_name: string
  position: string | null; role: string
  department: string | null
}
export type JournalReport = DailyReport & {
  author_id: string
  author: JournalMember | JournalMember[] | null
}

type Filters = {
  dept:    string | null
  user:    string | null
  blocker: boolean
  heavy:   boolean
  problem: boolean
}

// ── Вспомогательные ──────────────────────────────────────────────────────────
function isLateSubmission(createdAtIso: string): boolean {
  const hour = parseInt(
    new Intl.DateTimeFormat('en', { timeZone: 'Asia/Oral', hour: 'numeric', hour12: false })
      .format(new Date(createdAtIso)),
    10,
  )
  return hour >= 18
}

function authorOf(r: JournalReport): JournalMember | null {
  return Array.isArray(r.author) ? (r.author[0] ?? null) : r.author
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().split('T')[0]
}

function formatDayLabel(dateStr: string, today: string): { primary: string; relative: string | null } {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = d.toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', weekday: 'long' })
  const dm      = d.toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'long' })
  const primary = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${dm}`
  let relative: string | null = null
  if (dateStr === today)                       relative = 'Сегодня'
  else if (dateStr === shiftDate(today, -1))   relative = 'Вчера'
  return { primary, relative }
}

// ── Реакции (копия из TeamView, чтобы не рефакторить работающую страницу) ────
function ReactionsRow({ report, viewerId, canReact }: {
  report: JournalReport; viewerId: string; canReact: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const myReaction = report.reactions.find(r => r.profile_id === viewerId)
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of report.reactions) m.set(r.emoji, (m.get(r.emoji) ?? 0) + 1)
    return m
  }, [report.reactions])

  function handleClick(kind: string) {
    if (!canReact) return
    startTransition(async () => {
      await toggleDailyReaction({ reportId: report.id, emoji: kind })
      router.refresh()
    })
  }

  if (!canReact && report.reactions.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap pt-2"
      style={{ borderTop: '1px solid var(--border)' }}>
      {DAILY_REACTIONS.map(({ kind, icon: Icon, hint, color }) => {
        const count = counts.get(kind) ?? 0
        const mine = myReaction?.emoji === kind
        if (!canReact && count === 0) return null
        return (
          <button key={kind}
            onClick={() => handleClick(kind)}
            disabled={!canReact || pending}
            title={canReact ? hint : `${hint} · ${count}`}
            aria-label={hint}
            className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-lg transition-all disabled:opacity-60"
            style={{
              background: mine ? `color-mix(in oklab, ${color} 14%, transparent)` : count > 0 ? 'var(--surface-2)' : 'transparent',
              border: `1px solid ${mine ? `color-mix(in oklab, ${color} 40%, transparent)` : 'var(--border)'}`,
              cursor: canReact ? 'pointer' : 'default',
              color: mine ? color : count > 0 ? color : 'var(--text-dim)',
            }}>
            <Icon size={13} strokeWidth={1.8} />
            {count > 0 && (
              <span className="text-[11px] font-semibold num" style={{ color: mine ? color : 'var(--text-dim)' }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Карточка одного отчёта ────────────────────────────────────────────────────
function ReportCard({ report, viewerId, canReact, allowReact }: {
  report: JournalReport; viewerId: string; canReact: boolean
  // Реакции в журнале ставим только на «свежие» дни (today/yesterday).
  // Для старых отчётов кнопки реакций скрыты, но просмотр существующих остаётся.
  allowReact: boolean
}) {
  const [open, setOpen] = useState(false)
  const author = authorOf(report)
  const late = isLateSubmission(report.created_at)
  const wl = findWorkload(report.workload)
  const hours = report.report_tasks.reduce((s, t) => s + Number(t.hours_spent), 0)
  const positionLine = [author?.department, author?.position].filter(Boolean).join(' · ')

  const completed   = report.report_tasks.filter(t =>  t.is_completed)
  const inProgress  = report.report_tasks.filter(t => !t.is_completed)

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-3.5 text-left">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.25)' }}>
          {author?.full_name?.charAt(0) ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{author?.full_name}</p>
          {positionLine && (
            <p className="text-[11px] truncate" style={{ color: 'var(--text-dim)' }}>{positionLine}</p>
          )}
          <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--text-dim)' }}>{report.did_today}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {late && (
            <span title="Сдан после 18:00 по Оралу"
              className="inline-flex items-center justify-center w-5 h-5 rounded"
              style={{ background: 'color-mix(in oklab, var(--color-warn) 18%, transparent)', color: 'var(--color-warn)' }}>
              <Moon size={10} />
            </span>
          )}
          {wl && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded" title={wl.label}
              style={{ background: wl.bg, color: wl.color, border: `1px solid ${wl.border}` }}>
              <wl.icon size={11} strokeWidth={1.8} />
            </span>
          )}
          {hours > 0 && <span className="text-xs font-semibold num" style={{ color: '#60a5fa' }}>{hours}ч</span>}
          {report.has_blocker && <AlertTriangle size={13} style={{ color: '#f87171' }} />}
          <ChevronRight size={13} style={{
            color: 'var(--text-dim)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: '200ms',
          }} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="pt-3">
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-dim)' }}>Сделал</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{report.did_today}</p>
          </div>
          {completed.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--green)' }}>Завершил</p>
              <div className="space-y-1">
                {completed.map(t => (
                  <div key={t.id} className="flex justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Check size={11} style={{ color: 'var(--green)', flexShrink: 0 }} />
                      <span className="truncate"
                        style={{ color: 'var(--text-muted)', textDecoration: 'line-through', opacity: 0.7 }}>
                        {t.task_title}
                      </span>
                    </div>
                    <span className="font-semibold flex-shrink-0 ml-3" style={{ color: 'var(--green)' }}>
                      {t.hours_spent}ч
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {inProgress.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#60a5fa' }}>Работал над</p>
              {inProgress.map(t => (
                <div key={t.id} className="flex justify-between text-sm py-0.5">
                  <span className="truncate" style={{ color: 'var(--text-muted)' }}>{t.task_title}</span>
                  <span className="font-semibold flex-shrink-0 ml-3" style={{ color: '#60a5fa' }}>{t.hours_spent}ч</span>
                </div>
              ))}
            </div>
          )}
          {report.plan_tomorrow && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-dim)' }}>Завтра</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{report.plan_tomorrow}</p>
            </div>
          )}
          {report.has_blocker && (
            <div className="p-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-xs font-bold mb-1" style={{ color: '#f87171' }}>Блокер</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{report.blocker_text || '—'}</p>
            </div>
          )}
          <ReactionsRow report={report} viewerId={viewerId} canReact={canReact && allowReact} />
        </div>
      )}
    </div>
  )
}

// ── Секция одного дня ────────────────────────────────────────────────────────
type DayKind = 'today' | 'yesterday' | 'older'

function DaySection({
  date, today, todayInProgress, reports, members, viewerId, canReact, defaultOpen,
}: {
  date: string
  today: string
  todayInProgress: boolean
  reports: JournalReport[]
  members: JournalMember[]
  viewerId: string
  canReact: boolean
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const kind: DayKind =
    date === today                   ? 'today'     :
    date === shiftDate(today, -1)    ? 'yesterday' :
                                       'older'

  const { primary, relative } = formatDayLabel(date, today)
  const blockers = reports.filter(r => r.has_blocker)
  const totalHours = reports.reduce((s, r) =>
    s + r.report_tasks.reduce((rs, t) => rs + Number(t.hours_spent), 0), 0)

  // «Не сдали» считаем только для today/yesterday — список основан на ТЕКУЩИХ
  // активных. Для прошлых дней с уволенными/новыми сотрудниками показывать
  // эту цифру нечестно.
  const showNotReported = kind !== 'older'
  const reportedIds = new Set(reports.map(r => r.author_id))
  const notReported = showNotReported
    ? members.filter(m => !reportedIds.has(m.id))
    : []

  const headerCounts = showNotReported
    ? `${reports.length}/${members.length} сдали`
    : `${reports.length} ${pluralReports(reports.length)}`

  // Пустой день без отчётов — серый компактный блок, без раскрытия.
  if (reports.length === 0 && !showNotReported) {
    return (
      <div id={`day-${date}`} className="rounded-2xl p-3.5 opacity-70"
        style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            {primary}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            нет отчётов
          </span>
        </div>
      </div>
    )
  }

  return (
    <div id={`day-${date}`} className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Заголовок секции */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3.5 text-left hover-surface">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            {relative && (
              <span className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  background: kind === 'today'
                    ? 'color-mix(in oklab, var(--color-green) 15%, transparent)'
                    : 'color-mix(in oklab, var(--color-info) 12%, transparent)',
                  color: kind === 'today' ? 'var(--color-green)' : 'var(--color-info)',
                }}>
                {relative}
              </span>
            )}
            <span className="text-sm md:text-base font-semibold" style={{ color: 'var(--text)' }}>
              {primary}
            </span>
            {kind === 'today' && todayInProgress && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ color: 'var(--text-dim)', background: 'var(--surface-2)' }}
                title="День ещё не закончился — отчёты могут досдаваться">
                в процессе
              </span>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
            {headerCounts}
            {totalHours > 0 && <span> · <span style={{ color: '#60a5fa' }}>{totalHours}ч</span></span>}
            {blockers.length > 0 && (
              <span> · <span style={{ color: '#f87171' }}>{blockers.length} {pluralBlockers(blockers.length)}</span></span>
            )}
          </p>
        </div>
        <ChevronDown size={16}
          style={{
            color: 'var(--text-dim)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: '200ms',
            flexShrink: 0,
          }} />
      </button>

      {/* Тело секции */}
      {open && (
        <div className="px-3.5 pb-3.5 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Блокеры — выше карточек, как в TeamView */}
          {blockers.length > 0 && (
            <div className="mt-3 p-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} style={{ color: '#f87171' }} />
                <p className="text-xs font-bold" style={{ color: '#f87171' }}>
                  Блокеры дня · {blockers.length}
                </p>
              </div>
              <div className="space-y-1.5">
                {blockers.map(r => {
                  const author = authorOf(r)
                  return (
                    <div key={r.id} className="flex gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                        {author?.full_name?.charAt(0) ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: '#f87171' }}>{author?.full_name}</p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{r.blocker_text || '—'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Карточки сданных */}
          {reports.length > 0 && (
            <div className="space-y-2 pt-1">
              {reports.map(r => (
                <ReportCard key={r.id} report={r} viewerId={viewerId} canReact={canReact}
                  allowReact={kind !== 'older'} />
              ))}
            </div>
          )}

          {/* «Ещё не сдали» — только для today/yesterday */}
          {showNotReported && notReported.length > 0 && (
            <div className="p-3 rounded-xl"
              style={{ background: 'var(--surface-2)', border: '1px solid rgba(251,146,60,0.2)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#fb923c' }}>
                {kind === 'today' ? 'Ещё не сдали' : 'Не сдали'} · {notReported.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {notReported.map(m => (
                  <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c' }}>
                      {m.full_name.charAt(0)}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {m.full_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function pluralReports(n: number): string {
  const last = n % 10
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'отчётов'
  if (last === 1) return 'отчёт'
  if (last >= 2 && last <= 4) return 'отчёта'
  return 'отчётов'
}

function pluralBlockers(n: number): string {
  const last = n % 10
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'блокеров'
  if (last === 1) return 'блокер'
  if (last >= 2 && last <= 4) return 'блокера'
  return 'блокеров'
}

// ── Главный компонент ───────────────────────────────────────────────────────
const MAX_DAYS = 60
const PAGE_DAYS = 14

export default function JournalView({
  viewerId, canReact, today, todayInProgress,
  windowFrom, windowUntil, days, reports, members, filters,
}: {
  viewerId: string
  canReact: boolean
  today: string
  todayInProgress: boolean
  windowFrom: string
  windowUntil: string
  days: number
  reports: JournalReport[]
  members: JournalMember[]
  filters: Filters
}) {
  const sp = useSearchParams()

  // Все ДНИ окна (включая пустые) — лента непрерывная.
  const allDates = useMemo(() => {
    const out: string[] = []
    let d = windowUntil
    while (d >= windowFrom) {
      out.push(d)
      d = shiftDate(d, -1)
    }
    return out
  }, [windowFrom, windowUntil])

  // Уникальные отделы из members — для select-фильтра.
  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const m of members) if (m.department) set.add(m.department)
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [members])

  // ── Статистика для полосы обзора ───────────────────────────────────────
  // Считаем на основе ВСЕХ загруженных отчётов, без учёта фильтров — полоса
  // должна показывать честную картину окна (фильтры влияют только на ленту).
  const yesterday = useMemo(() => shiftDate(today, -1), [today])
  const heatmapStats = useMemo<DayStat[]>(() => {
    const byDate = new Map<string, JournalReport[]>()
    for (const r of reports) {
      const arr = byDate.get(r.report_date)
      if (arr) arr.push(r)
      else byDate.set(r.report_date, [r])
    }
    return allDates.map(date => {
      const day = byDate.get(date) ?? []
      const hours = day.reduce((s, r) =>
        s + r.report_tasks.reduce((rs, t) => rs + Number(t.hours_spent), 0), 0)
      const blockers = day.filter(r => r.has_blocker).length
      return {
        date,
        reports:     day.length,
        hours,
        blockers,
        isToday:     date === today,
        isYesterday: date === yesterday,
      }
    })
  }, [reports, allDates, today, yesterday])

  // ── Применение фильтров ────────────────────────────────────────────────
  // dept/user — фильтр на УРОВНЕ ОТЧЁТА (показываем только подходящие
  // карточки). blocker/heavy/problem — на УРОВНЕ ДНЯ (целиком скрываем
  // секции дней, не подходящие под условие).
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const author = authorOf(r)
      if (filters.dept && author?.department !== filters.dept) return false
      if (filters.user && r.author_id !== filters.user)        return false
      return true
    })
  }, [reports, filters.dept, filters.user])

  const reportsByDate = useMemo(() => {
    const m = new Map<string, JournalReport[]>()
    for (const r of filteredReports) {
      const arr = m.get(r.report_date)
      if (arr) arr.push(r)
      else m.set(r.report_date, [r])
    }
    return m
  }, [filteredReports])

  const visibleDates = useMemo(() => {
    return allDates.filter(date => {
      const dayReports = reportsByDate.get(date) ?? []
      if (filters.blocker && !dayReports.some(r => r.has_blocker)) return false
      if (filters.heavy   && !dayReports.some(r => r.workload === 4 || r.workload === 5)) return false
      if (filters.problem) {
        // «Проблемный день» = доля сданных < 70% от текущих активных.
        // Для прошлых дней members может не отражать тогдашний штат —
        // но сам факт «низкая активность» остаётся валидным сигналом.
        const ratio = members.length > 0 ? dayReports.length / members.length : 1
        if (ratio >= 0.7) return false
      }
      return true
    })
  }, [allDates, reportsByDate, filters.blocker, filters.heavy, filters.problem, members.length])

  // ── LoadMore через query ────────────────────────────────────────────────
  const canLoadMore = days < MAX_DAYS
  const nextDays = Math.min(MAX_DAYS, days + PAGE_DAYS)
  const loadMoreHref = useMemo(() => {
    const next = new URLSearchParams(sp?.toString() ?? '')
    next.set('view', 'history')
    next.set('days', String(nextDays))
    return `/dashboard/daily/team?${next.toString()}`
  }, [sp, nextDays])

  const hasAnyFilter =
    filters.dept !== null || filters.user !== null ||
    filters.blocker || filters.heavy || filters.problem

  return (
    <div className="space-y-3">
      <JournalHeatmap stats={heatmapStats} />

      <JournalFilters
        filters={filters}
        members={members}
        departments={departments}
      />

      {visibleDates.map(date => (
        <DaySection
          key={date}
          date={date}
          today={today}
          todayInProgress={todayInProgress}
          reports={reportsByDate.get(date) ?? []}
          members={members}
          viewerId={viewerId}
          canReact={canReact}
          defaultOpen={date === today}
        />
      ))}

      {visibleDates.length === 0 && (
        <div className="py-12 text-center rounded-2xl"
          style={{ border: '2px dashed var(--border)' }}>
          <Inbox size={28} className="mx-auto mb-2" style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            {hasAnyFilter ? 'Под фильтр ничего не подошло' : 'За это окно отчётов нет'}
          </p>
        </div>
      )}

      {/* LoadMore + статус окна */}
      <div className="pt-3">
        {canLoadMore ? (
          <Link
            href={loadMoreHref}
            scroll={false}
            className="flex items-center justify-center gap-2 w-full p-3 rounded-2xl text-sm font-medium transition-all"
            style={{
              background: 'var(--surface)',
              border: '1px dashed var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            <ArrowDown size={14} />
            Загрузить ещё {Math.min(PAGE_DAYS, MAX_DAYS - days)} {pluralDays(Math.min(PAGE_DAYS, MAX_DAYS - days))}
          </Link>
        ) : (
          <div className="p-3 rounded-2xl text-center text-xs"
            style={{
              background: 'var(--surface)',
              border: '1px dashed var(--border)',
              color: 'var(--text-dim)',
            }}>
            Достигнут потолок окна {MAX_DAYS} дней.
            <span className="block mt-1">Архив по месяцам — в следующих обновлениях.</span>
          </div>
        )}
      </div>
    </div>
  )
}

function pluralDays(n: number): string {
  const last = n % 10
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'дней'
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дня'
  return 'дней'
}
