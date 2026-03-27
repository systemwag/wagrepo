'use client'

import { useState, useEffect } from 'react'
import { AlertOctagon, AlertTriangle, Clock, CheckCircle, ChevronDown, ChevronRight, Briefcase, ClipboardList } from 'lucide-react'

export type TrafficCategory = 'red' | 'orange' | 'yellow' | 'green'

export interface DeadlineTask {
  id: string
  title: string
  type: 'task' | 'project'
  assigneeName: string
  deadline: string
  diffDays: number
  category: TrafficCategory
}

interface Props {
  tasks: DeadlineTask[]
}

const COLUMNS = [
  {
    id: 'red' as const,
    title: 'Просрочено',
    desc: 'Требует немедленного внимания',
    icon: <AlertOctagon size={16} />,
    color: '#f87171',
    colorDim: 'rgba(248,113,113,0.15)',
    border: 'rgba(248,113,113,0.3)',
    headerBg: 'rgba(239,68,68,0.08)',
  },
  {
    id: 'orange' as const,
    title: 'Горит',
    desc: 'Сегодня или завтра',
    icon: <AlertTriangle size={16} />,
    color: '#fb923c',
    colorDim: 'rgba(251,146,60,0.15)',
    border: 'rgba(251,146,60,0.3)',
    headerBg: 'rgba(249,115,22,0.08)',
  },
  {
    id: 'yellow' as const,
    title: 'Скоро',
    desc: '2–3 дня',
    icon: <Clock size={16} />,
    color: '#fbbf24',
    colorDim: 'rgba(251,191,36,0.15)',
    border: 'rgba(234,179,8,0.3)',
    headerBg: 'rgba(234,179,8,0.07)',
  },
  {
    id: 'green' as const,
    title: 'В графике',
    desc: 'Более 3 дней',
    icon: <CheckCircle size={16} />,
    color: 'var(--green)',
    colorDim: 'var(--green-glow)',
    border: 'rgba(34,197,94,0.25)',
    headerBg: 'rgba(34,197,94,0.06)',
  },
]

export default function TrafficLightBoard({ tasks }: Props) {
  const [greenExpanded, setGreenExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div
      className={isMobile ? 'flex flex-col gap-4 pb-4' : 'flex gap-3 overflow-x-auto pb-4'}
      style={isMobile ? undefined : { minHeight: '500px', alignItems: 'flex-start' }}
    >
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.category === col.id)
        const isGreen = col.id === 'green'

        if (isGreen) {
          return (
            <div
              key={col.id}
              className="flex flex-col rounded-2xl overflow-hidden transition-all"
              style={{
                width: isMobile ? '100%' : (greenExpanded ? '280px' : '220px'),
                flexShrink: isMobile ? undefined : 0,
                border: `1px solid ${col.border}`,
                background: 'var(--surface)',
              }}
            >
              {/* Хедер зелёной колонки — всегда виден */}
              <button
                type="button"
                onClick={() => setGreenExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
                style={{ background: col.headerBg, borderBottom: greenExpanded ? `1px solid ${col.border}` : 'none' }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: col.color }}>{col.icon}</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: col.color }}>{col.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{col.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: col.colorDim, color: col.color }}
                  >
                    {colTasks.length}
                  </span>
                  <span style={{ color: 'var(--text-dim)' }}>
                    {greenExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </div>
              </button>

              {/* Тело — только при раскрытии */}
              {greenExpanded && (
                <div className="flex flex-col gap-2.5 p-3 overflow-y-auto" style={{ maxHeight: '600px' }}>
                  {colTasks.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--text-dim)' }}>Пусто</p>
                  ) : (
                    colTasks.map(task => <TaskCard key={task.id} task={task} col={col} />)
                  )}
                </div>
              )}
            </div>
          )
        }

        return (
          <div
            key={col.id}
            className="flex flex-col rounded-2xl overflow-hidden"
            style={{
              flex: isMobile ? undefined : 1,
              width: isMobile ? '100%' : undefined,
              minWidth: isMobile ? undefined : '260px',
              border: `1px solid ${col.border}`,
              background: 'var(--surface)',
            }}
          >
            {/* Хедер колонки */}
            <div
              className="px-4 py-3.5 flex items-center justify-between"
              style={{ background: col.headerBg, borderBottom: `1px solid ${col.border}` }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: col.color }}>{col.icon}</span>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide" style={{ color: col.color }}>{col.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{col.desc}</p>
                </div>
              </div>
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: col.colorDim, color: col.color }}
              >
                {colTasks.length}
              </span>
            </div>

            {/* Карточки */}
            <div className="flex-1 p-3 flex flex-col gap-2.5 overflow-y-auto">
              {colTasks.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-10">
                  <p className="text-sm" style={{ color: 'var(--text-dim)', opacity: 0.5 }}>Пусто</p>
                </div>
              ) : (
                colTasks.map(task => <TaskCard key={task.id} task={task} col={col} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TaskCard({ task, col }: { task: DeadlineTask; col: typeof COLUMNS[number] }) {
  let diffLabel = ''
  if (task.diffDays < 0)       diffLabel = `${Math.abs(task.diffDays)} дн. назад`
  else if (task.diffDays === 0) diffLabel = 'Сегодня'
  else if (task.diffDays === 1) diffLabel = 'Завтра'
  else                          diffLabel = `${task.diffDays} дн.`

  const formattedDate = new Date(task.deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })
  const isProject = task.type === 'project'

  return (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-2.5 transition-all"
      style={{
        background: 'var(--surface-2)',
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${col.color}`,
      }}
    >
      {/* Тип + название */}
      <div className="flex items-start gap-2">
        <span
          className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5"
          style={{
            background: isProject ? 'rgba(139,92,246,0.12)' : 'rgba(59,130,246,0.12)',
            color: isProject ? '#a78bfa' : '#60a5fa',
            border: `1px solid ${isProject ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)'}`,
          }}
        >
          {isProject ? <Briefcase size={9} /> : <ClipboardList size={9} />}
          {isProject ? 'Проект' : 'Задача'}
        </span>
        <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>
          {task.title.length > 60 ? task.title.slice(0, 60) + '…' : task.title}
        </p>
      </div>

      {/* Нижняя строка: исполнитель + срок */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            {task.assigneeName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {task.assigneeName.split(' ')[0]}
          </span>
        </div>

        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
          style={{ background: col.colorDim, color: col.color }}
        >
          {diffLabel} · {formattedDate}
        </span>
      </div>
    </div>
  )
}
