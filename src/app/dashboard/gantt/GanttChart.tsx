'use client'

import { useMemo } from 'react'

export type Stage = {
  id: string
  name: string
  order_index: number
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
  stages: Stage[]
}

const STAGE_COLORS = [
  '#22c55e',
  '#60a5fa',
  '#f59e0b',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#38bdf8',
  '#f472b6',
]

const statusStyle: Record<string, React.CSSProperties> = {
  active:    { background: 'rgba(34,197,94,0.12)',  color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' },
  on_hold:   { background: 'rgba(234,179,8,0.1)',   color: '#ca8a04', border: '1px solid rgba(234,179,8,0.2)' },
  completed: { background: 'rgba(96,165,250,0.1)',  color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' },
  cancelled: { background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' },
}

const statusLabel: Record<string, string> = {
  active: 'Активный', on_hold: 'На паузе', completed: 'Завершён', cancelled: 'Отменён',
}

const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function dateDiff(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(d: Date) {
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`
}

export default function GanttChart({ projects }: { projects: Project[] }) {
  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])

  const { months, ticks, rangeStart, totalDays } = useMemo(() => {
    const allDates: Date[] = []
    projects.forEach(p => {
      if (p.start_date) allDates.push(new Date(p.start_date))
      if (p.deadline)   allDates.push(new Date(p.deadline))
      p.stages?.forEach(s => { if (s.deadline) allDates.push(new Date(s.deadline)) })
    })

    const base = allDates.length
      ? new Date(Math.min(...allDates.map(d => d.getTime())))
      : today

    const cap = allDates.length
      ? new Date(Math.max(...allDates.map(d => d.getTime())))
      : today

    const rangeStart = new Date(base.getFullYear(), base.getMonth() - 1, 1)
    const rangeEnd   = new Date(cap.getFullYear(),  cap.getMonth()  + 2, 0)
    const totalDays  = Math.ceil(dateDiff(rangeStart, rangeEnd))

    // Месяцы
    const months: { label: string; days: number }[] = []
    const cur = new Date(rangeStart)
    while (cur <= rangeEnd) {
      const y = cur.getFullYear(), m = cur.getMonth()
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const startDay = cur.getDate()
      const days = daysInMonth - startDay + 1
      months.push({ label: `${MONTHS_RU[m]} ${y !== new Date().getFullYear() ? y : ''}`.trim(), days: Math.min(days, totalDays) })
      cur.setMonth(m + 1); cur.setDate(1)
    }

    // Тики каждые 7 дней
    const ticks: { pct: number; label: string }[] = []
    const tick = new Date(rangeStart)
    while (tick <= rangeEnd) {
      const offset = dateDiff(rangeStart, tick)
      ticks.push({ pct: (offset / totalDays) * 100, label: `${tick.getDate()}` })
      tick.setDate(tick.getDate() + 7)
    }

    return { months, ticks, rangeStart, totalDays }
  }, [projects, today])

  const todayPct = (dateDiff(rangeStart, today) / totalDays) * 100

  function pct(d: Date) {
    return Math.max(0, (dateDiff(rangeStart, d) / totalDays) * 100)
  }

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
      <div className="overflow-x-auto">
        <div style={{ minWidth: 900 }}>

          {/* ── Шапка: строка месяцев ── */}
          <div className="flex sticky top-0 z-20" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="flex-shrink-0 px-4 flex items-end pb-1" style={{ width: 260, borderRight: '1px solid var(--border)', height: 52 }}>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Проект / Этап</span>
            </div>
            <div className="flex-1 relative" style={{ height: 52 }}>
              {/* Месяцы */}
              <div className="absolute top-0 left-0 right-0 flex" style={{ height: 26, borderBottom: '1px solid var(--border)' }}>
                {months.map((m, i) => (
                  <div key={i} className="px-2 flex items-center text-xs font-medium"
                    style={{ width: `${(m.days / totalDays) * 100}%`, minWidth: 0, borderRight: '1px solid var(--border)', color: 'var(--text-muted)', overflow: 'hidden' }}>
                    {m.label}
                  </div>
                ))}
              </div>
              {/* Числа дней (тики каждые 7 дней) */}
              <div className="absolute bottom-0 left-0 right-0" style={{ height: 26 }}>
                {ticks.map((t, i) => (
                  <div key={i} className="absolute flex flex-col items-center" style={{ left: `${t.pct}%`, transform: 'translateX(-50%)' }}>
                    <div className="w-px" style={{ height: 4, background: 'var(--border-2)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-dim)', fontSize: 10 }}>{t.label}</span>
                  </div>
                ))}
                {/* Линия сегодня в шапке */}
                {todayPct >= 0 && todayPct <= 100 && (
                  <div className="absolute top-0 bottom-0 w-px z-10"
                    style={{ left: `${todayPct}%`, background: 'rgba(248,113,113,0.8)' }}>
                    <span className="absolute -top-0.5 left-1 text-xs font-medium whitespace-nowrap" style={{ color: '#f87171', fontSize: 10 }}>
                      {formatDate(today)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Строки проектов ── */}
          {projects.map(project => {
            const projStart = project.start_date ? new Date(project.start_date) : today
            const projEnd   = project.deadline   ? new Date(project.deadline)   : null

            const sortedStages = [...(project.stages ?? [])]
              .filter(s => s.deadline)
              .sort((a, b) => a.order_index - b.order_index)

            return (
              <div key={project.id}>
                {/* Проект — заголовок */}
                <div className="flex" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <div className="flex-shrink-0 px-4 py-2.5 flex items-center gap-2" style={{ width: 260, borderRight: '1px solid var(--border)' }}>
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{project.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium" style={statusStyle[project.status]}>
                      {statusLabel[project.status]}
                    </span>
                  </div>
                  <div className="flex-1 relative" style={{ height: 44 }}>
                    <Grid months={months} totalDays={totalDays} todayPct={todayPct} />
                    {/* Тонкая направляющая полоска всего проекта */}
                    {projEnd && (
                      <div className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full"
                        style={{ left: `${pct(projStart)}%`, width: `${Math.max(0.3, pct(projEnd) - pct(projStart))}%`, background: 'var(--border-2)' }} />
                    )}
                  </div>
                </div>

                {/* Этапы */}
                {sortedStages.map((stage, si) => {
                  const color      = STAGE_COLORS[si % STAGE_COLORS.length]
                  const stageEnd   = new Date(stage.deadline!)
                  const stageStart = si === 0 ? projStart : new Date(sortedStages[si - 1].deadline!)
                  const days       = Math.max(1, dateDiff(stageStart, stageEnd))
                  const isOverdue  = stageEnd < today
                  const barColor   = isOverdue ? '#ef4444' : color

                  const leftPct  = pct(stageStart)
                  const widthPct = Math.max(0.5, pct(stageEnd) - leftPct)
                  const midPct   = leftPct + widthPct / 2

                  return (
                    <div key={stage.id} className="flex" style={{ borderBottom: '1px solid rgba(26,38,32,0.4)' }}>
                      {/* Левая колонка */}
                      <div className="flex-shrink-0 flex items-center gap-2 px-4"
                        style={{ width: 260, borderRight: '1px solid var(--border)', height: 48, paddingLeft: 28 }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: barColor }} />
                        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{stage.name}</span>
                        {stage.assignee && (
                          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-dim)', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {stage.assignee.full_name.split(' ')[0]}
                          </span>
                        )}
                      </div>

                      {/* Область Ганта */}
                      <div className="flex-1 relative" style={{ height: 48 }}>
                        <Grid months={months} totalDays={totalDays} todayPct={todayPct} />

                        {/* Полоска (без overflow:hidden — текст рядом) */}
                        <div className="absolute rounded-lg"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            minWidth: 6,
                            top: '50%',
                            height: 28,
                            transform: 'translateY(-50%)',
                            background: barColor + '30',
                            border: `1px solid ${barColor}70`,
                          }}
                        />

                        {/* Счётчик дней — центр полоски, НЕ внутри overflow:hidden */}
                        <div className="absolute pointer-events-none"
                          style={{
                            left: `${midPct}%`,
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 5,
                          }}
                        >
                          <span className="text-xs font-bold whitespace-nowrap px-1.5 py-0.5 rounded-md"
                            style={{
                              color: barColor,
                              background: 'var(--bg)',
                              border: `1px solid ${barColor}55`,
                              lineHeight: 1.4,
                            }}>
                            {days} дн.
                          </span>
                        </div>

                        {/* Дата окончания — справа от полоски */}
                        <div className="absolute pointer-events-none"
                          style={{
                            left: `${leftPct + widthPct}%`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            paddingLeft: 6,
                            zIndex: 5,
                          }}
                        >
                          <span className="text-xs whitespace-nowrap"
                            style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            {formatDate(stageEnd)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Проект без этапов */}
                {sortedStages.length === 0 && projEnd && (() => {
                  const days     = Math.max(1, dateDiff(projStart, projEnd))
                  const leftPct  = pct(projStart)
                  const widthPct = Math.max(0.5, pct(projEnd) - leftPct)
                  const midPct   = leftPct + widthPct / 2
                  return (
                    <div className="flex" style={{ borderBottom: '1px solid rgba(26,38,32,0.4)' }}>
                      <div className="flex-shrink-0 px-4 flex items-center" style={{ width: 260, borderRight: '1px solid var(--border)', height: 48, paddingLeft: 28 }}>
                        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Этапы не заданы</span>
                      </div>
                      <div className="flex-1 relative" style={{ height: 48 }}>
                        <Grid months={months} totalDays={totalDays} todayPct={todayPct} />
                        <div className="absolute rounded-lg"
                          style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: 6, top: '50%', height: 28, transform: 'translateY(-50%)', background: '#22c55e28', border: '1px solid #22c55e55' }} />
                        <div className="absolute pointer-events-none" style={{ left: `${midPct}%`, top: '50%', transform: 'translate(-50%,-50%)', zIndex: 5 }}>
                          <span className="text-xs font-bold whitespace-nowrap px-1.5 py-0.5 rounded-md"
                            style={{ color: '#22c55e', background: 'var(--bg)', border: '1px solid #22c55e55', lineHeight: 1.4 }}>
                            {days} дн.
                          </span>
                        </div>
                        <div className="absolute pointer-events-none" style={{ left: `${leftPct + widthPct}%`, top: '50%', transform: 'translateY(-50%)', paddingLeft: 6, zIndex: 5 }}>
                          <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatDate(projEnd)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      </div>

      {/* Легенда */}
      <div className="flex items-center gap-5 px-6 py-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
        {STAGE_COLORS.slice(0, 5).map((color, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Этап {i + 1}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: '#f87171' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Просрочен</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-px h-3" style={{ background: 'rgba(248,113,113,0.7)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Сегодня</span>
        </div>
      </div>
    </div>
  )
}

function Grid({ months, totalDays, todayPct }: { months: { days: number }[]; totalDays: number; todayPct: number }) {
  return (
    <>
      <div className="absolute inset-0 flex pointer-events-none">
        {months.map((m, i) => (
          <div key={i} className="h-full" style={{ width: `${(m.days / totalDays) * 100}%`, borderRight: '1px solid rgba(26,38,32,0.3)' }} />
        ))}
      </div>
      {todayPct >= 0 && todayPct <= 100 && (
        <div className="absolute top-0 bottom-0 w-px pointer-events-none z-10"
          style={{ left: `${todayPct}%`, background: 'rgba(248,113,113,0.45)' }} />
      )}
    </>
  )
}

function _buildRange(rangeStart: Date, rangeEnd: Date) {
  const totalDays = Math.ceil(dateDiff(rangeStart, rangeEnd))
  const months: { label: string; days: number }[] = []
  const cur = new Date(rangeStart)
  while (cur <= rangeEnd) {
    const y = cur.getFullYear(), m = cur.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    months.push({ label: `${MONTHS_RU[m]} ${y !== new Date().getFullYear() ? y : ''}`.trim(), days: Math.min(daysInMonth - cur.getDate() + 1, totalDays) })
    cur.setMonth(m + 1); cur.setDate(1)
  }
  return { months, rangeStart, totalDays }
}
