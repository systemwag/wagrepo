'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertOctagon, AlertTriangle, Clock, CheckCircle, CalendarOff,
  ChevronDown, Briefcase, ClipboardList, Send, UserX, ListChecks,
} from 'lucide-react'

export type DeadlineCategory = 'red' | 'orange' | 'yellow' | 'green' | 'none'
export type DeadlineEntityType = 'direct_task' | 'project_task' | 'project' | 'checklist'

export interface DeadlineItem {
  /** Уникальный ключ React: `${type}-${sourceId}`. */
  id: string
  /** UUID самой сущности (без префикса) — для focus-ссылок и junction-сопоставлений. */
  sourceId: string
  type: DeadlineEntityType
  title: string
  projectId: string | null
  projectName: string | null
  stageId: string | null
  assignees: { id: string; full_name: string }[]
  /** YYYY-MM-DD или null. */
  deadline: string | null
  /** Разница в днях от сегодня (Asia/Oral). null = срок не задан. */
  diffDays: number | null
  category: DeadlineCategory
  href: string
  status: string
}

const ENTITY_BADGE: Record<DeadlineEntityType, {
  label: string; icon: React.ReactNode; bg: string; color: string; border: string
}> = {
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
  checklist: {
    label: 'Чек-лист',
    icon: <ListChecks size={9} />,
    bg: 'rgba(20,184,166,0.12)',
    color: '#2dd4bf',
    border: 'rgba(20,184,166,0.2)',
  },
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
  {
    id: 'none' as const,
    title: 'Без срока',
    desc: 'Дедлайн не задан',
    icon: <CalendarOff size={16} />,
    color: 'var(--text-muted)',
    colorDim: 'color-mix(in oklab, var(--color-text-muted) 12%, transparent)',
    border: 'var(--color-border)',
    headerBg: 'color-mix(in oklab, var(--color-text-muted) 6%, transparent)',
  },
]

interface Props {
  items: DeadlineItem[]
}

/**
 * Светофор дедлайнов. 5 колонок: red/orange/yellow/green/none.
 * Сворачиваемые колонки — только зелёная и «без срока», и только если в них
 * больше LARGE_COLUMN_THRESHOLD карточек (иначе раскрываем по умолчанию —
 * иначе единственный активный проект просто не виден).
 */
const LARGE_COLUMN_THRESHOLD = 15

export default function TrafficLightBoard({ items }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 pb-4 items-start">
      {COLUMNS.map(col => {
        const colItems = items.filter(t => t.category === col.id)
        return <Column key={col.id} col={col} items={colItems} />
      })}
    </div>
  )
}

function Column({
  col, items,
}: {
  col: typeof COLUMNS[number]
  items: DeadlineItem[]
}) {
  const collapsible = (col.id === 'green' || col.id === 'none') && items.length > LARGE_COLUMN_THRESHOLD
  const [open, setOpen] = useState(!collapsible)

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${col.border}`, background: 'var(--surface)' }}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3.5 transition-colors text-left"
          style={{
            background: col.headerBg,
            borderBottom: open ? `1px solid ${col.border}` : 'none',
          }}
        >
          <ColumnHeaderInner col={col} count={items.length} />
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-dim)',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s',
            }}
          />
        </button>
      ) : (
        <div
          className="px-4 py-3.5 flex items-center justify-between"
          style={{ background: col.headerBg, borderBottom: `1px solid ${col.border}` }}
        >
          <ColumnHeaderInner col={col} count={items.length} />
        </div>
      )}

      {open && (
        <div
          className="flex-1 p-3 flex flex-col gap-2.5 overflow-y-auto"
          style={{ maxHeight: collapsible ? '640px' : undefined }}
        >
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <p className="text-sm" style={{ color: 'var(--text-dim)', opacity: 0.5 }}>Пусто</p>
            </div>
          ) : (
            items.map(item => <ItemCard key={item.id} item={item} col={col} />)
          )}
        </div>
      )}
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

function formatDateLabel(diffDays: number | null): string {
  if (diffDays === null) return 'Срок не задан'
  if (diffDays < 0) {
    const days = Math.abs(diffDays)
    return `Просрочено на ${days} ${pluralDays(days)}`
  }
  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Завтра'
  return `Через ${diffDays} ${pluralDays(diffDays)}`
}

function pluralDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня'
  return 'дней'
}

function ItemCard({ item, col }: { item: DeadlineItem; col: typeof COLUMNS[number] }) {
  const badge = ENTITY_BADGE[item.type]
  const isUnassigned = item.assignees.length === 0
  const formattedDate = item.deadline
    ? new Date(item.deadline + 'T00:00:00').toLocaleDateString('ru-RU', {
        timeZone: 'Asia/Oral',
        day: 'numeric',
        month: 'short',
      })
    : ''
  const bigLabel = formatDateLabel(item.diffDays)

  // Для project_task / checklist показываем имя проекта подзаголовком, а не
  // склеиваем в title — так читается лучше и можно безопасно clamp.
  const showProjectSubtitle = (item.type === 'project_task' || item.type === 'checklist') && item.projectName

  return (
    <Link
      href={item.href}
      className="deadline-card rounded-xl p-3.5 flex flex-col gap-2.5 transition-all"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${col.color === 'var(--text-muted)' ? 'var(--border-2)' : col.color}`,
      }}
    >
      {/* Тип + название */}
      <div className="flex items-start gap-2">
        <span
          className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5"
          style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
        >
          {badge.icon}
          {badge.label}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium leading-snug"
            style={{
              color: 'var(--text)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.title}
          </p>
          {showProjectSubtitle && (
            <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-dim)' }}>
              {item.projectName}
            </p>
          )}
        </div>
      </div>

      {/* Нижняя строка: исполнители + срок */}
      <div className="flex items-center justify-between gap-2">
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
            {item.type === 'project' ? 'Без ПМ' : 'Не назначен'}
          </span>
        ) : (
          <AssigneesStack assignees={item.assignees} />
        )}

        <div className="flex flex-col items-end flex-shrink-0">
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-lg leading-tight"
            style={{ background: col.colorDim, color: col.color }}
          >
            {bigLabel}
          </span>
          {formattedDate && (
            <span className="text-[10px] mt-0.5 num" style={{ color: 'var(--text-dim)' }}>
              {formattedDate}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function AssigneesStack({ assignees }: { assignees: DeadlineItem['assignees'] }) {
  const shown = assignees.slice(0, 3)
  const extra = assignees.length - shown.length
  const firstName = assignees.length === 1 ? assignees[0].full_name.split(' ')[0] : null

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex -space-x-1.5">
        {shown.map(a => (
          <div
            key={a.id}
            title={a.full_name}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            {a.full_name.charAt(0).toUpperCase()}
          </div>
        ))}
        {extra > 0 && (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            +{extra}
          </div>
        )}
      </div>
      {firstName && (
        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {firstName}
        </span>
      )}
    </div>
  )
}
