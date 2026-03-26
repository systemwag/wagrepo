'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronRight, Users, Check } from 'lucide-react'

// ── Типы ─────────────────────────────────────────────────────────────────────
type ReportTask = { id: string; task_id: string | null; stage_id: string | null; task_title: string; hours_spent: number; is_completed: boolean }
type DailyReport = {
  id: string; report_date: string; did_today: string; plan_tomorrow: string | null
  has_blocker: boolean; blocker_text: string | null; workload: number | null
  created_at: string; report_tasks: ReportTask[]
}
export type TeamMember = { id: string; full_name: string; position: string | null; role: string }
export type TeamReport = DailyReport & { author_id: string; author: TeamMember | TeamMember[] | null }

const WORKLOAD = [
  { value: 1, label: 'Мало',   emoji: '😴', color: '#60a5fa' },
  { value: 2, label: 'Норма',  emoji: '🙂', color: 'var(--green)' },
  { value: 3, label: 'Занят',  emoji: '💪', color: '#f59e0b' },
  { value: 4, label: 'Тяжело', emoji: '🔥', color: '#fb923c' },
  { value: 5, label: 'Аврал',  emoji: '🆘', color: '#f87171' },
]

// ── Карточка отчёта сотрудника ────────────────────────────────────────────────
function TeamReportCard({ report, author, wl, hours }: {
  report: TeamReport
  author: TeamMember | null | undefined
  wl: typeof WORKLOAD[0] | undefined
  hours: number
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-3.5 text-left">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.25)' }}>
          {author?.full_name?.charAt(0) ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{author?.full_name}</p>
          <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--text-dim)' }}>{report.did_today}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {wl && <span className="text-sm">{wl.emoji}</span>}
          {hours > 0 && <span className="text-xs font-semibold" style={{ color: '#60a5fa' }}>{hours}ч</span>}
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
        </div>
      )}
    </div>
  )
}

// ── Вид команды ───────────────────────────────────────────────────────────────
export default function TeamView({ teamReports, teamMembers }: {
  teamReports: TeamReport[]
  teamMembers: TeamMember[]
}) {
  const reportedIds = new Set(teamReports.map(r => r.author_id))
  const notReported = teamMembers.filter(m => !reportedIds.has(m.id))
  const blockers = teamReports.filter(r => r.has_blocker)
  const totalH = teamReports.reduce((s, r) =>
    s + r.report_tasks.reduce((rs, t) => rs + Number(t.hours_spent), 0), 0)

  return (
    <div className="space-y-5">
      {/* Стат-блок */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Отчитались',    value: teamReports.length, color: 'var(--green)', bg: 'var(--green-glow)' },
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
      {blockers.length > 0 && (
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
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{m.full_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Отчитались */}
      {teamReports.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider px-1" style={{ color: 'var(--text-dim)' }}>
            Отчитались сегодня
          </p>
          {teamReports.map(r => {
            const author = Array.isArray(r.author) ? r.author[0] : r.author
            const wl = WORKLOAD.find(w => w.value === r.workload)
            const hours = r.report_tasks.reduce((s, t) => s + Number(t.hours_spent), 0)
            return <TeamReportCard key={r.id} report={r} author={author} wl={wl} hours={hours} />
          })}
        </div>
      )}

      {teamReports.length === 0 && notReported.length === 0 && (
        <div className="py-16 text-center rounded-2xl" style={{ border: '2px dashed var(--border)' }}>
          <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Пока никто не сдал отчёт</p>
        </div>
      )}
    </div>
  )
}
