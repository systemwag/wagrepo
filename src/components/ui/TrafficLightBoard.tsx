'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertOctagon, AlertTriangle, Clock, CheckCircle, ChevronDown, Briefcase, ClipboardList, Send, UserX } from 'lucide-react'

export type TrafficCategory = 'red' | 'orange' | 'yellow' | 'green'

/** Тип сущности на карточке светофора. */
export type DeadlineEntityType = 'direct_task' | 'project_task' | 'project'

export interface DeadlineTask {
  id: string
  title: string
  type: DeadlineEntityType
  /** Полное имя или null, если исполнитель/менеджер не назначен. */
  assigneeName: string | null
  deadline: string
  diffDays: number
  category: TrafficCategory
  /** Куда вести при клике (проект или журнал поручений). */
  href: string
}

/** Конфиг бейджа для каждого типа карточки. */
const ENTITY_BADGE: Record<DeadlineEntityType, { label: string; icon: React.ReactNode; bg: string; color: string; border: string }> = {
  direct_task: {
    label: 'Поручение',
    icon: <Send size={9} />,
    bg: 'color-mix(in oklab, var(--color-warn) 12%, transparent)',
    color: 'var(--color-warn)',
    border: 'color-mix(in oklab, var(--color-warn) 25%, transparent)',
  },
  project_task: {
    label: 'Задача',
    icon: <ClipboardList size={9} />,
    bg: 'rgba(59,130,246,0.12)',
    color: '#60a5fa',
    border: 'rgba(59,130,246,0.2)',
  },
  project: {
    label: 'Проект',
    icon: <Briefcase size={9} />,
    bg: 'rgba(139,92,246,0.12)',
    color: '#a78bfa',
    border: 'rgba(139,92,246,0.2)',
  },
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
      className={isMobile ? 'flex flex-col gap-4 pb-4' : 'grid grid-cols-4 gap-3 pb-4'}
      style={isMobile ? undefined : { alignItems: 'flex-start' }}
    >
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.category === col.id)
        const isGreen = col.id === 'green'
        const expanded = !isGreen || greenExpanded

        return (
          <div
            key={col.id}
            className="flex flex-col rounded-2xl overflow-hidden"
            style={{
              border: `1px solid ${col.border}`,
              background: 'var(--surface)',
            }}
          >
            {/* Хедер колонки. Для зелёной — clickable toggle, для остальных — статика. */}
            {isGreen ? (
              <button
                type="button"
                onClick={() => setGreenExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-3.5 transition-colors text-left"
                style={{ background: col.headerBg, borderBottom: expanded ? `1px solid ${col.border}` : 'none' }}
              >
                <ColumnHeaderInner col={col} count={colTasks.length} />
                <ChevronDown
                  size={14}
                  style={{
                    color: 'var(--text-dim)',
                    transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
            ) : (
              <div
                className="px-4 py-3.5 flex items-center justify-between"
                style={{ background: col.headerBg, borderBottom: `1px solid ${col.border}` }}
              >
                <ColumnHeaderInner col={col} count={colTasks.length} />
              </div>
            )}

            {/* Тело */}
            {expanded && (
              <div className="flex-1 p-3 flex flex-col gap-2.5 overflow-y-auto" style={{ maxHeight: isGreen ? '600px' : undefined }}>
                {colTasks.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-10">
                    <p className="text-sm" style={{ color: 'var(--text-dim)', opacity: 0.5 }}>Пусто</p>
                  </div>
                ) : (
                  colTasks.map(task => <TaskCard key={task.id} task={task} col={col} />)
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ColumnHeaderInner({ col, count }: { col: typeof COLUMNS[number]; count: number }) {
  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ color: col.color }}>{col.icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide truncate" style={{ color: col.color }}>{col.title}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-dim)' }}>{col.desc}</p>
        </div>
      </div>
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ml-2"
        style={{ background: col.colorDim, color: col.color }}
      >
        {count}
      </span>
    </>
  )
}

/**
 * Формат даты по контексту:
 *  - red:    «Просрочено на N дн.» + дата мелким
 *  - orange: «Сегодня» / «Завтра»  + дата мелким
 *  - yellow/green: «Через N дн.»   + дата мелким
 */
function formatDateLabels(diffDays: number): { big: string; small: string } {
  if (diffDays < 0) {
    const days = Math.abs(diffDays)
    return { big: `Просрочено на ${days} ${pluralDays(days)}`, small: '' }
  }
  if (diffDays === 0) return { big: 'Сегодня',  small: '' }
  if (diffDays === 1) return { big: 'Завтра',   small: '' }
  return { big: `Через ${diffDays} ${pluralDays(diffDays)}`, small: '' }
}

function pluralDays(n: number): string {
  const mod10  = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11)                 return 'день'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня'
  return 'дней'
}

function TaskCard({ task, col }: { task: DeadlineTask; col: typeof COLUMNS[number] }) {
  const { big } = formatDateLabels(task.diffDays)
  const formattedDate = new Date(task.deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })
  const badge = ENTITY_BADGE[task.type]
  const isProject = task.type === 'project'
  const isUnassigned = !task.assigneeName
  const firstName = task.assigneeName ? task.assigneeName.split(' ')[0] : null

  return (
    <Link
      href={task.href}
      className="rounded-xl p-3.5 flex flex-col gap-2.5 transition-all group"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${col.color}`,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'color-mix(in oklab, var(--color-surface-2) 100%, var(--color-text) 4%)'
        el.style.borderColor = col.border
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'var(--surface-2)'
        el.style.borderColor = 'var(--border)'
      }}
    >
      {/* Тип + название */}
      <div className="flex items-start gap-2">
        <span
          className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5"
          style={{
            background: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
          }}
        >
          {badge.icon}
          {badge.label}
        </span>
        <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>
          {task.title.length > 60 ? task.title.slice(0, 60) + '…' : task.title}
        </p>
      </div>

      {/* Нижняя строка: исполнитель + срок */}
      <div className="flex items-center justify-between gap-2">
        {/* Исполнитель */}
        {isUnassigned ? (
          <span
            className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md flex-shrink-0"
            style={{
              color: 'var(--color-warn)',
              background: 'color-mix(in oklab, var(--color-warn) 10%, transparent)',
              border: '1px solid color-mix(in oklab, var(--color-warn) 25%, transparent)',
            }}
          >
            <UserX size={11} />
            {isProject ? 'Без ПМ' : 'Не назначен'}
          </span>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              {task.assigneeName!.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {firstName}
            </span>
          </div>
        )}

        {/* Срок */}
        <div className="flex flex-col items-end flex-shrink-0">
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-lg leading-tight"
            style={{ background: col.colorDim, color: col.color }}
          >
            {big}
          </span>
          <span className="text-[10px] mt-0.5 num" style={{ color: 'var(--text-dim)' }}>
            {formattedDate}
          </span>
        </div>
      </div>
    </Link>
  )
}
