'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronRight, Users, Check, Moon, Filter, X, Flame } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toggleDailyReaction } from '@/lib/actions/daily'
import { findWorkload, DAILY_REACTIONS } from '@/lib/constants/workload'

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
export type TeamMember = {
  id: string; full_name: string
  position: string | null; role: string
  department: string | null
}
export type TeamReport = DailyReport & {
  author_id: string
  author: TeamMember | TeamMember[] | null
}

function isLateSubmission(createdAtIso: string): boolean {
  const hour = parseInt(
    new Intl.DateTimeFormat('en', { timeZone: 'Asia/Oral', hour: 'numeric', hour12: false })
      .format(new Date(createdAtIso)),
    10,
  )
  return hour >= 18
}

// ── Реакции под карточкой ────────────────────────────────────────────────────
function ReactionsRow({ report, viewerId, canReact }: {
  report: TeamReport; viewerId: string; canReact: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const myReaction = report.reactions.find(r => r.profile_id === viewerId)
  // [kind -> count]
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of report.reactions) m.set(r.emoji, (m.get(r.emoji) ?? 0) + 1)
    return m
  }, [report.reactions])

  function handleClick(kind: string) {
    if (!canReact) return
    startTransition(async () => {
      // `emoji` в БД — это поле TEXT, мы кладём туда наш короткий kind-ключ.
      await toggleDailyReaction({ reportId: report.id, emoji: kind })
      router.refresh()
    })
  }

  if (!canReact && report.reactions.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap pt-2" style={{ borderTop: '1px solid var(--border)' }}>
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
            {count > 0 && <span className="text-[11px] font-semibold num" style={{ color: mine ? color : 'var(--text-dim)' }}>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ── Карточка отчёта сотрудника ────────────────────────────────────────────────
function TeamReportCard({ report, author, wl, hours, viewerId, canReact }: {
  report: TeamReport
  author: TeamMember | null | undefined
  wl: ReturnType<typeof findWorkload>
  hours: number
  viewerId: string
  canReact: boolean
}) {
  const [open, setOpen] = useState(false)
  const late = isLateSubmission(report.created_at)
  const positionLine = [author?.department, author?.position].filter(Boolean).join(' · ')

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
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
          <ChevronRight size={13} style={{ color: 'var(--text-dim)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: '200ms' }} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="pt-3">
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-dim)' }}>Сделал</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{report.did_today}</p>
          </div>
          {report.report_tasks?.length > 0 && (
            <div className="space-y-2">
              {report.report_tasks.filter(t => t.is_completed).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--green)' }}>Завершил</p>
                  <div className="space-y-1">
                    {report.report_tasks.filter(t => t.is_completed).map(t => (
                      <div key={t.id} className="flex justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Check size={11} style={{ color: 'var(--green)', flexShrink: 0 }} />
                          <span className="truncate" style={{ color: 'var(--text-muted)', textDecoration: 'line-through', opacity: 0.7 }}>{t.task_title}</span>
                        </div>
                        <span className="font-semibold flex-shrink-0 ml-3" style={{ color: 'var(--green)' }}>{t.hours_spent}ч</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {report.report_tasks.filter(t => !t.is_completed).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#60a5fa' }}>Работал над</p>
                  {report.report_tasks.filter(t => !t.is_completed).map(t => (
                    <div key={t.id} className="flex justify-between text-sm py-0.5">
                      <span className="truncate" style={{ color: 'var(--text-muted)' }}>{t.task_title}</span>
                      <span className="font-semibold flex-shrink-0 ml-3" style={{ color: '#60a5fa' }}>{t.hours_spent}ч</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {report.plan_tomorrow && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-dim)' }}>Завтра</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{report.plan_tomorrow}</p>
            </div>
          )}
          {report.has_blocker && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-xs font-bold mb-1" style={{ color: '#f87171' }}>Блокер</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{report.blocker_text || '—'}</p>
            </div>
          )}
          <ReactionsRow report={report} viewerId={viewerId} canReact={canReact} />
        </div>
      )}
    </div>
  )
}

// ── Вид команды ───────────────────────────────────────────────────────────────
export default function TeamView({ teamReports, teamMembers, viewerId, canReact }: {
  teamReports: TeamReport[]
  teamMembers: TeamMember[]
  viewerId: string
  canReact: boolean
}) {
  const router = useRouter()

  // ── Realtime ─────────────────────────────────────────────────────────────
  // Когда сотрудник сдаёт/обновляет отчёт или директор ставит реакцию —
  // дёргаем router.refresh(), который перерендерит серверную страницу.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('daily-team')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' },          () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_report_tasks' },     () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_report_reactions' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  // ── Фильтры ──────────────────────────────────────────────────────────────
  const [filterDept, setFilterDept] = useState<string | null>(null)
  const [onlyBlockers, setOnlyBlockers] = useState(false)
  const [onlyHeavy, setOnlyHeavy] = useState(false)
  const [onlyNotReported, setOnlyNotReported] = useState(false)

  // Список отделов: уникальные значения из teamMembers, без пустых.
  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const m of teamMembers) if (m.department) set.add(m.department)
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [teamMembers])

  // ── Применение фильтров ─────────────────────────────────────────────────
  const filteredReports = useMemo(() => {
    return teamReports.filter(r => {
      const author = Array.isArray(r.author) ? r.author[0] : r.author
      if (filterDept && author?.department !== filterDept) return false
      if (onlyBlockers && !r.has_blocker) return false
      if (onlyHeavy && !(r.workload === 4 || r.workload === 5)) return false
      return true
    })
  }, [teamReports, filterDept, onlyBlockers, onlyHeavy])

  const reportedIds = new Set(teamReports.map(r => r.author_id))
  const notReportedAll = teamMembers.filter(m => !reportedIds.has(m.id))
  const notReported = filterDept ? notReportedAll.filter(m => m.department === filterDept) : notReportedAll

  const blockers = filteredReports.filter(r => r.has_blocker)
  const totalH = filteredReports.reduce((s, r) =>
    s + r.report_tasks.reduce((rs, t) => rs + Number(t.hours_spent), 0), 0)

  // «Только не отчитались» — переключаем секцию: остаётся блок «Не сдали»,
  // а сданные не рендерим. Сделано отдельным флагом, чтобы директор мог
  // быстро «выудить» список адресатов напоминания.
  const showReported = !onlyNotReported

  const hasAnyFilter = filterDept !== null || onlyBlockers || onlyHeavy || onlyNotReported
  function resetFilters() {
    setFilterDept(null); setOnlyBlockers(false); setOnlyHeavy(false); setOnlyNotReported(false)
  }

  return (
    <div className="space-y-5">
      {/* ── Фильтры ── */}
      <div className="p-3 rounded-2xl space-y-2"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={12} style={{ color: 'var(--text-dim)' }} />
          <span className="text-xs font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--text-dim)' }}>
            Фильтры
          </span>

          {departments.length > 0 && (
            <select
              value={filterDept ?? ''}
              onChange={e => setFilterDept(e.target.value || null)}
              className="text-xs rounded-lg px-2 py-1 outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <option value="">Все отделы</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          <FilterChip active={onlyBlockers} onClick={() => setOnlyBlockers(v => !v)} tone="danger">
            <AlertTriangle size={11} /> С блокером
          </FilterChip>
          <FilterChip active={onlyHeavy} onClick={() => setOnlyHeavy(v => !v)} tone="warn">
            <Flame size={11} /> Тяжело / Аврал
          </FilterChip>
          <FilterChip active={onlyNotReported} onClick={() => setOnlyNotReported(v => !v)} tone="warn">
            Только не сдали
          </FilterChip>

          {hasAnyFilter && (
            <button onClick={resetFilters}
              className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
              <X size={11} /> сбросить
            </button>
          )}
        </div>
      </div>

      {/* ── Стат-блок ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Отчитались',    value: showReported ? filteredReports.length : teamReports.length, color: 'var(--green)', bg: 'var(--green-glow)' },
          { label: 'Не отчитались', value: notReported.length, color: '#fb923c',      bg: 'rgba(251,146,60,0.1)' },
          { label: 'Часов всего',   value: `${totalH}ч`,       color: '#60a5fa',      bg: 'rgba(59,130,246,0.1)' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-2xl text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Блокеры команды */}
      {!onlyNotReported && blockers.length > 0 && (
        <div className="p-4 rounded-2xl"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} style={{ color: '#f87171' }} />
            <p className="text-sm font-bold" style={{ color: '#f87171' }}>Блокеры команды · {blockers.length}</p>
          </div>
          <div className="space-y-2">
            {blockers.map(r => {
              const author = Array.isArray(r.author) ? r.author[0] : r.author
              return (
                <div key={r.id} className="flex gap-2.5">
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

      {/* Не отчитались */}
      {notReported.length > 0 && (
        <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid rgba(251,146,60,0.25)' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#fb923c' }}>
            Ещё не сдали отчёт · {notReported.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {notReported.map(m => (
              <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c' }}>
                  {m.full_name.charAt(0)}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  {m.full_name}
                  {m.department && <span className="ml-1 text-[11px]" style={{ color: 'var(--text-dim)' }}>· {m.department}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Отчитались */}
      {showReported && filteredReports.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider px-1" style={{ color: 'var(--text-dim)' }}>
            Отчитались сегодня
          </p>
          {filteredReports.map(r => {
            const author = Array.isArray(r.author) ? r.author[0] : r.author
            const wl = findWorkload(r.workload)
            const hours = r.report_tasks.reduce((s, t) => s + Number(t.hours_spent), 0)
            return <TeamReportCard key={r.id} report={r} author={author} wl={wl} hours={hours} viewerId={viewerId} canReact={canReact} />
          })}
        </div>
      )}

      {teamReports.length === 0 && notReportedAll.length === 0 && (
        <div className="py-16 text-center rounded-2xl" style={{ border: '2px dashed var(--border)' }}>
          <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>В компании пока нет сотрудников для дейли</p>
        </div>
      )}

      {teamReports.length > 0 && showReported && filteredReports.length === 0 && hasAnyFilter && (
        <div className="py-10 text-center rounded-2xl" style={{ border: '2px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Под фильтр ничего не подошло</p>
          <button onClick={resetFilters} className="mt-2 text-xs underline" style={{ color: 'var(--green)' }}>
            Сбросить фильтры
          </button>
        </div>
      )}

    </div>
  )
}

// ── Фильтр-chip ──────────────────────────────────────────────────────────────
function FilterChip({ active, onClick, tone, children }: {
  active: boolean; onClick: () => void
  tone: 'warn' | 'danger' | 'info'
  children: React.ReactNode
}) {
  const color =
    tone === 'danger' ? '#f87171' :
    tone === 'warn'   ? '#fb923c' :
                        '#60a5fa'
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
      style={{
        background: active ? `color-mix(in oklab, ${color} 14%, transparent)` : 'var(--surface-2)',
        border: `1px solid ${active ? `color-mix(in oklab, ${color} 35%, transparent)` : 'var(--border)'}`,
        color: active ? color : 'var(--text-dim)',
      }}>
      {children}
    </button>
  )
}
