'use client'

import { useState } from 'react'
import {
  CheckCircle2, Clock, AlertTriangle, ChevronRight,
  Users, History, FileText, Flame,
  Check, Plus, Minus,
} from 'lucide-react'
import { submitDailyReport } from '@/lib/actions/daily'

// ── Типы ─────────────────────────────────────────────────────────────────────
type Profile = { id: string; full_name: string; role: string }
type ActiveTask  = { id: string; title: string; status: string; project: { name: string } | null }
type ActiveStage = { id: string; name: string; status: string; project: { id: string; name: string } | null; deadline: string | null }
type ReportTask  = { id: string; task_id: string | null; stage_id: string | null; task_title: string; hours_spent: number; is_completed: boolean }
type DailyReport = {
  id: string
  report_date: string
  did_today: string
  plan_tomorrow: string | null
  has_blocker: boolean
  blocker_text: string | null
  workload: number | null
  created_at: string
  report_tasks: ReportTask[]
}

// ── Константы ─────────────────────────────────────────────────────────────────
const WORKLOAD = [
  { value: 1, label: 'Мало',     emoji: '😴', color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)'  },
  { value: 2, label: 'Норма',    emoji: '🙂', color: 'var(--green)', bg: 'var(--green-glow)', border: 'rgba(34,197,94,0.3)'   },
  { value: 3, label: 'Занят',    emoji: '💪', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)'  },
  { value: 4, label: 'Тяжело',   emoji: '🔥', color: '#fb923c', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)'  },
  { value: 5, label: 'Аврал',    emoji: '🆘', color: '#f87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)'   },
]

function totalHours(tasks: ReportTask[]) {
  return tasks.reduce((s, t) => s + Number(t.hours_spent), 0)
}

// ── Вычислить streak ──────────────────────────────────────────────────────────
function calcStreak(history: DailyReport[], today: string): number {
  const dates = new Set(history.map(r => r.report_date))
  let streak = 0
  const d = new Date(today)
  // Если сегодня ещё нет отчёта — начинаем со вчера
  if (!dates.has(today)) d.setDate(d.getDate() - 1)
  while (dates.has(d.toISOString().split('T')[0])) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ── Основной компонент ────────────────────────────────────────────────────────
export default function DailyReportClient({
  profile, today, todayReport, activeTasks, activeStages, history, historyFrom, teamReports, teamMembers,
}: {
  profile: Profile
  today: string
  todayReport: DailyReport | null
  activeTasks: ActiveTask[]
  activeStages: ActiveStage[]
  history: DailyReport[]
  historyFrom: string
  teamReports: TeamReport[]
  teamMembers: TeamMember[]
}) {
  const isManager = profile.role === 'director' || profile.role === 'manager'
  const tabs = ['report', 'history', ...(isManager ? ['team'] : [])] as const
  const TAB_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
    report:  { icon: <FileText size={15} />,  label: 'Мой отчёт'  },
    history: { icon: <History size={15} />,   label: 'История'    },
    team:    { icon: <Users size={15} />,     label: 'Команда'    },
  }

  const [tab, setTab] = useState<string>('report')
  const [editing, setEditing] = useState(!todayReport)
  const streak = calcStreak(history, today)

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Шапка ── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Дейли-отчёт</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {new Date(today).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)', color: '#fb923c' }}>
            <Flame size={15} />
            <span className="text-sm font-bold">{streak}</span>
            <span className="text-xs">{streak === 1 ? 'день подряд' : streak < 5 ? 'дня подряд' : 'дней подряд'}</span>
          </div>
        )}
      </div>

      {/* ── Табы ── */}
      <div className="flex gap-1 p-1 rounded-xl mb-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {tabs.map(t => {
          const cfg = TAB_LABELS[t]
          const active = tab === t
          const hasBadge = t === 'team' && teamMembers.length > 0 && teamMembers.length - teamReports.length > 0
          return (
            <button key={t} onClick={() => setTab(t)}
              className="flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? 'var(--surface-2)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-dim)',
                border: active ? '1px solid var(--border-2)' : '1px solid transparent',
              }}>
              {cfg.icon}{cfg.label}
              {hasBadge && (
                <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c' }}>
                  {teamMembers.length - teamReports.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Контент ── */}
      {tab === 'report' && (
        todayReport && !editing
          ? <ReportView report={todayReport} onEdit={() => setEditing(true)} />
          : <ReportForm
              activeTasks={activeTasks}
              activeStages={activeStages}
              existing={todayReport}
              onSubmitted={() => setEditing(false)}
            />
      )}
      {tab === 'history' && (
        <HistoryView history={history} historyFrom={historyFrom} today={today} />
      )}
      {tab === 'team' && isManager && (
        <TeamView teamReports={teamReports} teamMembers={teamMembers} />
      )}
    </div>
  )
}

// ── Просмотр сданного отчёта ──────────────────────────────────────────────────
function ReportView({ report, onEdit }: { report: DailyReport; onEdit: () => void }) {
  const wl = WORKLOAD.find(w => w.value === report.workload)
  const hours = totalHours(report.report_tasks)

  return (
    <div className="space-y-4">
      {/* Статус сдан */}
      <div className="flex items-center justify-between p-4 rounded-2xl"
        style={{ background: 'var(--green-glow)', border: '1px solid rgba(34,197,94,0.25)' }}>
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} style={{ color: 'var(--green)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--green)' }}>Отчёт сдан</p>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {new Date(report.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              {hours > 0 && ` · ${hours} ч`}
            </p>
          </div>
        </div>
        <button onClick={onEdit}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          Редактировать
        </button>
      </div>

      {/* Загруженность */}
      {wl && (
        <div className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-2xl">{wl.emoji}</span>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'var(--text-dim)' }}>Загруженность</p>
            <p className="text-sm font-bold" style={{ color: wl.color }}>{wl.label}</p>
          </div>
        </div>
      )}

      {/* Что сделал */}
      <ReportBlock icon={<Check size={14} />} title="Что сделал сегодня" color="var(--green)">
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{report.did_today}</p>
      </ReportBlock>

      {/* Завершил сегодня */}
      {report.report_tasks.filter(t => t.is_completed).length > 0 && (
        <ReportBlock icon={<CheckCircle2 size={14} />} title="Завершил сегодня" color="var(--green)">
          <div className="space-y-1.5">
            {report.report_tasks.filter(t => t.is_completed).map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--green-glow)', border: '1px solid rgba(34,197,94,0.4)' }}>
                    <Check size={9} style={{ color: 'var(--green)' }} />
                  </div>
                  <span className="text-sm truncate" style={{ color: 'var(--text)', textDecoration: 'line-through', opacity: 0.7 }}>
                    {t.task_title}
                  </span>
                </div>
                <span className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--green)' }}>{t.hours_spent} ч</span>
              </div>
            ))}
          </div>
        </ReportBlock>
      )}

      {/* Задачи — работал, но не завершил */}
      {report.report_tasks.filter(t => !t.is_completed).length > 0 && (
        <ReportBlock icon={<Clock size={14} />} title="Работал над" color="#60a5fa">
          <div className="space-y-2">
            {report.report_tasks.filter(t => !t.is_completed).map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{t.task_title}</span>
                <span className="text-sm font-semibold flex-shrink-0" style={{ color: '#60a5fa' }}>{t.hours_spent} ч</span>
              </div>
            ))}
            <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>Итого</span>
              <span className="text-sm font-bold" style={{ color: '#60a5fa' }}>{hours} ч</span>
            </div>
          </div>
        </ReportBlock>
      )}

      {/* Планы на завтра */}
      {report.plan_tomorrow && (
        <ReportBlock icon={<ChevronRight size={14} />} title="Планирую завтра" color="#a78bfa">
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{report.plan_tomorrow}</p>
        </ReportBlock>
      )}

      {/* Блокеры */}
      {report.has_blocker && (
        <div className="p-4 rounded-2xl"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: '#f87171' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#f87171' }}>Блокер</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {report.blocker_text || 'Есть блокирующая проблема'}
          </p>
        </div>
      )}
    </div>
  )
}

function ReportBlock({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode
}) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color }}>{icon}</span>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{title}</p>
      </div>
      {children}
    </div>
  )
}

// ── Форма отчёта ──────────────────────────────────────────────────────────────
function ReportForm({ activeTasks, activeStages, existing, onSubmitted }: {
  activeTasks: ActiveTask[]
  activeStages: ActiveStage[]
  existing: DailyReport | null
  onSubmitted: () => void
}) {
  const [didToday, setDidToday] = useState(existing?.did_today ?? '')
  const [planTomorrow, setPlanTomorrow] = useState(existing?.plan_tomorrow ?? '')
  const [hasBlocker, setHasBlocker] = useState(existing?.has_blocker ?? false)
  const [blockerText, setBlockerText] = useState(existing?.blocker_text ?? '')
  const [workload, setWorkload] = useState(existing?.workload ?? 3)

  type WorkEntry = {
    kind: 'task' | 'stage'
    id: string
    title: string
    project: string | null
    hours: string
    checked: boolean
    isCompleted: boolean
  }

  const [taskEntries, setTaskEntries] = useState<WorkEntry[]>(() => {
    const existingTaskMap  = new Map(existing?.report_tasks.filter(t => t.task_id).map(t => [t.task_id!, t]) ?? [])
    const existingStageMap = new Map(existing?.report_tasks.filter(t => t.stage_id).map(t => [t.stage_id!, t]) ?? [])

    const taskItems: WorkEntry[] = activeTasks.map(t => {
      const ex = existingTaskMap.get(t.id)
      return {
        kind: 'task', id: t.id, title: t.title,
        project: t.project?.name ?? null,
        hours: ex ? String(ex.hours_spent) : '1',
        checked: !!ex, isCompleted: ex?.is_completed ?? false,
      }
    })

    const stageItems: WorkEntry[] = activeStages.map(s => {
      const ex = existingStageMap.get(s.id)
      return {
        kind: 'stage', id: s.id, title: s.name,
        project: s.project?.name ?? null,
        hours: ex ? String(ex.hours_spent) : '1',
        checked: !!ex, isCompleted: ex?.is_completed ?? false,
      }
    })

    return [...taskItems, ...stageItems]
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleTask(idx: number) {
    setTaskEntries(prev => prev.map((e, i) =>
      i === idx ? { ...e, checked: !e.checked, isCompleted: !e.checked ? e.isCompleted : false } : e
    ))
  }

  function toggleCompleted(idx: number) {
    setTaskEntries(prev => prev.map((e, i) =>
      i === idx ? { ...e, isCompleted: !e.isCompleted, checked: true } : e
    ))
  }

  function setHours(idx: number, val: string) {
    setTaskEntries(prev => prev.map((e, i) => i === idx ? { ...e, hours: val } : e))
  }

  function adjustHours(idx: number, delta: number) {
    setTaskEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e
      const next = Math.max(0.5, Math.min(12, (parseFloat(e.hours) || 1) + delta))
      return { ...e, hours: String(next) }
    }))
  }

  async function handleSubmit() {
    if (!didToday.trim()) { setError('Опишите что было сделано сегодня'); return }
    const checkedTasks = taskEntries.filter(t => t.checked)
    for (const t of checkedTasks) {
      if (!parseFloat(t.hours) || parseFloat(t.hours) <= 0) {
        setError(`Укажите корректные часы для задачи "${t.title}"`); return
      }
    }
    setSaving(true); setError(null)
    const result = await submitDailyReport({
      did_today: didToday,
      plan_tomorrow: planTomorrow,
      has_blocker: hasBlocker,
      blocker_text: blockerText,
      workload,
      tasks: checkedTasks.map(t => ({
        task_id:      t.kind === 'task'  ? t.id : null,
        stage_id:     t.kind === 'stage' ? t.id : null,
        task_title:   t.title,
        hours_spent:  parseFloat(t.hours),
        is_completed: t.isCompleted,
      })),
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    onSubmitted()
  }

  const totalH = taskEntries.filter(t => t.checked).reduce((s, t) => s + (parseFloat(t.hours) || 0), 0)

  return (
    <div className="space-y-5">
      {/* Загруженность */}
      <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-dim)' }}>
          Загруженность сегодня
        </p>
        <div className="grid grid-cols-5 gap-2">
          {WORKLOAD.map(w => (
            <button key={w.value} onClick={() => setWorkload(w.value)}
              className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
              style={{
                background: workload === w.value ? w.bg : 'var(--surface-2)',
                border: `1px solid ${workload === w.value ? w.border : 'var(--border)'}`,
              }}>
              <span className="text-lg">{w.emoji}</span>
              <span className="text-[10px] font-semibold" style={{ color: workload === w.value ? w.color : 'var(--text-dim)' }}>
                {w.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Что сделал */}
      <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-dim)' }}>
          Что сделал сегодня *
        </label>
        <textarea
          value={didToday} onChange={e => setDidToday(e.target.value)}
          rows={3} placeholder="Опишите проделанную работу..."
          className="w-full outline-none resize-none text-sm rounded-xl p-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
        />
      </div>

      {/* Работа сегодня */}
      {taskEntries.length > 0 && (
        <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
              Что делал сегодня
            </p>
            {totalH > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                итого {totalH} ч
              </span>
            )}
          </div>
          <div className="space-y-2">
            {taskEntries.map((entry, idx) => {
              const proj = entry.project
              const borderColor = entry.isCompleted
                ? 'rgba(34,197,94,0.3)'
                : entry.checked ? 'rgba(59,130,246,0.2)' : 'var(--border)'
              const bgColor = entry.isCompleted
                ? 'rgba(34,197,94,0.06)'
                : entry.checked ? 'rgba(59,130,246,0.06)' : 'var(--surface-2)'
              return (
                <div key={entry.id}
                  className="p-2.5 rounded-xl transition-all"
                  style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                  <div className="flex items-center gap-3">
                    {/* Чекбокс "работал" */}
                    <button onClick={() => toggleTask(idx)}
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: entry.checked ? (entry.isCompleted ? 'var(--green)' : '#3b82f6') : 'var(--surface)',
                        border: `1.5px solid ${entry.checked ? (entry.isCompleted ? 'var(--green)' : '#3b82f6') : 'var(--border-2)'}`,
                      }}>
                      {entry.checked && <Check size={11} color="white" />}
                    </button>

                    {/* Название + тип */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={entry.kind === 'stage'
                            ? { background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }
                            : { background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }
                          }>
                          {entry.kind === 'stage' ? 'Этап' : 'Задача'}
                        </span>
                        <p className="text-sm truncate"
                          style={{
                            color: entry.checked ? 'var(--text)' : 'var(--text-muted)',
                            textDecoration: entry.isCompleted ? 'line-through' : 'none',
                            opacity: entry.isCompleted ? 0.6 : 1,
                          }}>
                          {entry.title}
                        </p>
                      </div>
                      {proj && <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-dim)' }}>{proj}</p>}
                    </div>

                    {/* Кнопка "Завершил" — только если задача отмечена */}
                    {entry.checked && (
                      <button onClick={() => toggleCompleted(idx)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0 transition-all"
                        style={{
                          background: entry.isCompleted ? 'var(--green-glow)' : 'var(--surface)',
                          color: entry.isCompleted ? 'var(--green)' : 'var(--text-dim)',
                          border: `1px solid ${entry.isCompleted ? 'rgba(34,197,94,0.35)' : 'var(--border)'}`,
                        }}>
                        <CheckCircle2 size={11} />
                        {entry.isCompleted ? 'Готово' : 'Завершил?'}
                      </button>
                    )}
                  </div>

                  {/* Часы — показывать если отмечено */}
                  {entry.checked && (
                    <div className="flex items-center gap-2 mt-2 pl-8">
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Часов:</span>
                      <button onClick={() => adjustHours(idx, -0.5)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                        <Minus size={10} />
                      </button>
                      <input
                        type="number" value={entry.hours} onChange={e => setHours(idx, e.target.value)}
                        step="0.5" min="0.5" max="12"
                        className="w-12 text-center outline-none text-sm font-bold rounded-lg p-1"
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: entry.isCompleted ? 'var(--green)' : '#60a5fa',
                        }}
                      />
                      <button onClick={() => adjustHours(idx, 0.5)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                        <Plus size={10} />
                      </button>
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>ч</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Планы на завтра */}
      <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-dim)' }}>
          Планирую завтра
        </label>
        <textarea
          value={planTomorrow} onChange={e => setPlanTomorrow(e.target.value)}
          rows={2} placeholder="Что запланировано на завтра..."
          className="w-full outline-none resize-none text-sm rounded-xl p-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
        />
      </div>

      {/* Блокер */}
      <div className="p-4 rounded-2xl"
        style={{
          background: hasBlocker ? 'rgba(239,68,68,0.05)' : 'var(--surface)',
          border: `1px solid ${hasBlocker ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
          transition: 'all 200ms',
        }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} style={{ color: hasBlocker ? '#f87171' : 'var(--text-dim)' }} />
            <span className="text-sm font-semibold" style={{ color: hasBlocker ? '#f87171' : 'var(--text-muted)' }}>
              Есть блокер
            </span>
          </div>
          <button onClick={() => setHasBlocker(b => !b)}
            className="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
            style={{ background: hasBlocker ? 'rgba(239,68,68,0.4)' : 'var(--surface-2)', border: `1px solid ${hasBlocker ? 'rgba(239,68,68,0.5)' : 'var(--border-2)'}` }}>
            <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
              style={{
                background: hasBlocker ? '#f87171' : 'var(--text-dim)',
                left: hasBlocker ? 'calc(100% - 18px)' : '2px',
              }} />
          </button>
        </div>
        {hasBlocker && (
          <textarea
            value={blockerText} onChange={e => setBlockerText(e.target.value)}
            rows={2} placeholder="Что мешает продвигаться вперёд?"
            className="w-full outline-none resize-none text-sm rounded-xl p-3 mt-3"
            style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--text)', fontFamily: 'inherit' }}
          />
        )}
      </div>

      {error && (
        <p className="text-sm px-4 py-3 rounded-xl"
          style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </p>
      )}

      <button onClick={handleSubmit} disabled={saving}
        className="w-full btn-green flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50"
        style={{ padding: '12px' }}>
        <CheckCircle2 size={16} />
        {saving ? 'Сохранение...' : existing ? 'Обновить отчёт' : 'Сдать отчёт'}
      </button>
    </div>
  )
}

// ── История ───────────────────────────────────────────────────────────────────
function HistoryView({ history, historyFrom: _historyFrom, today }: {
  history: DailyReport[]; historyFrom: string; today: string
}) {
  const reportMap = new Map(history.map(r => [r.report_date, r]))

  // Построить 14 дней назад → сегодня
  const days: string[] = []
  const d = new Date(today)
  for (let i = 0; i < 14; i++) {
    days.unshift(d.toISOString().split('T')[0])
    d.setDate(d.getDate() - 1)
  }

  if (history.length === 0) {
    return (
      <div className="py-20 text-center rounded-2xl" style={{ border: '2px dashed var(--border)' }}>
        <History size={32} className="mx-auto mb-3" style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>История отчётов появится здесь</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Мини-календарь активности */}
      <div className="p-4 rounded-2xl mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-dim)' }}>
          Активность за 14 дней
        </p>
        <div className="flex gap-1.5">
          {days.map(date => {
            const has = reportMap.has(date)
            const isToday = date === today
            return (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full aspect-square rounded-md"
                  style={{
                    background: has ? 'var(--green)' : 'var(--surface-2)',
                    border: `1px solid ${isToday ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`,
                    opacity: has ? 1 : 0.4,
                    boxShadow: has ? '0 0 6px rgba(34,197,94,0.3)' : 'none',
                  }} />
                <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>
                  {new Date(date).getDate()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Список отчётов */}
      {history.map(report => {
        const wl = WORKLOAD.find(w => w.value === report.workload)
        const hours = totalHours(report.report_tasks)
        return (
          <HistoryCard key={report.id} report={report} wl={wl} hours={hours} />
        )
      })}
    </div>
  )
}

function HistoryCard({ report, wl, hours }: { report: DailyReport; wl: typeof WORKLOAD[0] | undefined; hours: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left transition-colors">
        {/* Дата */}
        <div className="w-10 text-center flex-shrink-0">
          <p className="text-lg font-bold leading-none" style={{ color: 'var(--text)' }}>
            {new Date(report.report_date).getDate()}
          </p>
          <p className="text-[10px] uppercase" style={{ color: 'var(--text-dim)' }}>
            {new Date(report.report_date).toLocaleDateString('ru-RU', { month: 'short' })}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm line-clamp-1" style={{ color: 'var(--text-muted)' }}>{report.did_today}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {wl && (
              <span className="text-xs font-medium" style={{ color: wl.color }}>
                {wl.emoji} {wl.label}
              </span>
            )}
            {hours > 0 && (
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>· {hours} ч</span>
            )}
            {report.has_blocker && (
              <span className="text-xs font-semibold" style={{ color: '#f87171' }}>· ⚠ блокер</span>
            )}
          </div>
        </div>

        <ChevronRight size={15} style={{
          color: 'var(--text-dim)', flexShrink: 0,
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: '200ms',
        }} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="pt-3">
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-dim)' }}>Сделал</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{report.did_today}</p>
          </div>
          {report.report_tasks.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>Задачи</p>
              {report.report_tasks.map(t => (
                <div key={t.id} className="flex justify-between text-sm py-0.5">
                  <span className="truncate" style={{ color: 'var(--text-muted)' }}>{t.task_title}</span>
                  <span className="font-semibold flex-shrink-0 ml-3" style={{ color: '#60a5fa' }}>{t.hours_spent} ч</span>
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
          {report.has_blocker && report.blocker_text && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-xs font-bold mb-1" style={{ color: '#f87171' }}>Блокер</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{report.blocker_text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Команда ───────────────────────────────────────────────────────────────────
type TeamMember = { id: string; full_name: string; position: string | null; role: string }
type TeamReport = DailyReport & { author_id: string; author: TeamMember | TeamMember[] | null }

function TeamView({ teamReports, teamMembers }: {
  teamReports: TeamReport[]; teamMembers: TeamMember[]
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
          { label: 'Отчитались',    value: teamReports.length,   color: 'var(--green)', bg: 'var(--green-glow)' },
          { label: 'Не отчитались', value: notReported.length,   color: '#fb923c',      bg: 'rgba(251,146,60,0.1)' },
          { label: 'Часов всего',   value: `${totalH}ч`,         color: '#60a5fa',      bg: 'rgba(59,130,246,0.1)' },
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
            <p className="text-sm font-bold" style={{ color: '#f87171' }}>
              Блокеры команды · {blockers.length}
            </p>
          </div>
          <div className="space-y-2">
            {blockers.map((r) => {
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
            {notReported.map((m) => (
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
          {teamReports.map((r) => {
            const author = Array.isArray(r.author) ? r.author[0] : r.author
            const wl = WORKLOAD.find(w => w.value === r.workload)
            const hours = r.report_tasks.reduce((s, t) => s + Number(t.hours_spent), 0)
            return (
              <TeamReportCard key={r.id} report={r} author={author} wl={wl} hours={hours} />
            )
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

function TeamReportCard({ report, author, wl, hours }: {
  report: TeamReport; author: TeamMember | null | undefined; wl: typeof WORKLOAD[0] | undefined; hours: number
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
          <ChevronRight size={13} style={{
            color: 'var(--text-dim)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: '200ms',
          }} />
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
              {report.report_tasks.filter((t: ReportTask) => t.is_completed).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--green)' }}>
                    ✓ Завершил
                  </p>
                  {report.report_tasks.filter((t: ReportTask) => t.is_completed).map((t: ReportTask) => (
                    <div key={t.id} className="flex justify-between text-sm py-0.5">
                      <span className="truncate" style={{ color: 'var(--text-muted)', textDecoration: 'line-through', opacity: 0.7 }}>
                        {t.task_title}
                      </span>
                      <span className="font-semibold ml-3 flex-shrink-0" style={{ color: 'var(--green)' }}>{t.hours_spent} ч</span>
                    </div>
                  ))}
                </div>
              )}
              {report.report_tasks.filter((t: ReportTask) => !t.is_completed).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#60a5fa' }}>
                    В процессе
                  </p>
                  {report.report_tasks.filter((t: ReportTask) => !t.is_completed).map((t: ReportTask) => (
                    <div key={t.id} className="flex justify-between text-sm py-0.5">
                      <span className="truncate" style={{ color: 'var(--text-muted)' }}>{t.task_title}</span>
                      <span className="font-semibold ml-3 flex-shrink-0" style={{ color: '#60a5fa' }}>{t.hours_spent} ч</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {report.plan_tomorrow && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-dim)' }}>Завтра</p>
              <p className="text-sm" style={{ color: 'var(--text)' }}>{report.plan_tomorrow}</p>
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
