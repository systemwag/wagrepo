'use client'

import {
  PlusCircle, RefreshCw, Trash2, CheckCircle2, MessageSquare,
  Calendar, CalendarPlus, CalendarX, FolderPlus, ArrowRight,
} from 'lucide-react'

export interface ActivityItem {
  id: string
  actor: { id: string; full_name: string }
  entity_type: 'task' | 'project' | 'stage' | 'event'
  entity_id: string
  action: string
  meta: Record<string, unknown> | null
  created_at: string
}

interface Props {
  activities: ActivityItem[]
}

// ── Статусы ──────────────────────────────────────────────────────────────────

const TASK_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  todo:        { label: 'К выполнению', color: 'var(--text-muted)',  bg: 'rgba(255,255,255,0.06)' },
  in_progress: { label: 'В работе',     color: '#60a5fa',            bg: 'rgba(59,130,246,0.12)'  },
  review:      { label: 'На проверке',  color: '#fbbf24',            bg: 'rgba(251,191,36,0.12)'  },
  done:        { label: 'Выполнено',    color: 'var(--green)',        bg: 'var(--green-glow)'      },
}

const REVIEW_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: 'Одобрено',        color: 'var(--green)', bg: 'var(--green-glow)'      },
  rejected: { label: 'Отклонено',       color: '#f87171',      bg: 'rgba(248,113,113,0.12)' },
  pending:  { label: 'На рассмотрении', color: '#fbbf24',      bg: 'rgba(251,191,36,0.12)'  },
}

// ── Конфиг действий ──────────────────────────────────────────────────────────

type ActionCfg = {
  icon: React.ReactNode
  color: string
  bg: string
  verb: string
}

const ACTION_CONFIG: Record<string, ActionCfg> = {
  'project.created':      { icon: <FolderPlus size={15} />,   color: '#818cf8', bg: 'rgba(99,102,241,0.14)',  verb: 'создал(а) проект'           },
  'task.created':         { icon: <PlusCircle size={15} />,   color: '#60a5fa', bg: 'rgba(59,130,246,0.14)',  verb: 'создал(а) поручение'        },
  'task.updated':         { icon: <RefreshCw size={15} />,    color: '#fbbf24', bg: 'rgba(251,191,36,0.14)',  verb: 'обновил(а) задачу'          },
  'task.deleted':         { icon: <Trash2 size={15} />,       color: '#f87171', bg: 'rgba(248,113,113,0.14)', verb: 'удалил(а) задачу'           },
  'task.status_changed':  { icon: <CheckCircle2 size={15} />, color: 'var(--green)', bg: 'var(--green-glow)', verb: 'изменил(а) статус'          },
  'task.feedback':        { icon: <MessageSquare size={15} />,color: '#fb923c', bg: 'rgba(251,146,60,0.14)',  verb: 'отчитался(ась) по задаче'   },
  'stage.status_changed': { icon: <RefreshCw size={15} />,    color: '#a78bfa', bg: 'rgba(139,92,246,0.14)',  verb: 'обновил(а) статус стадии'   },
  'stage.review_changed': { icon: <CheckCircle2 size={15} />, color: 'var(--green)', bg: 'var(--green-glow)', verb: 'проверил(а) стадию'         },
  'event.created':        { icon: <CalendarPlus size={15} />, color: '#60a5fa', bg: 'rgba(59,130,246,0.14)',  verb: 'создал(а) мероприятие'      },
  'event.updated':        { icon: <Calendar size={15} />,     color: '#fbbf24', bg: 'rgba(251,191,36,0.14)',  verb: 'обновил(а) мероприятие'     },
  'event.deleted':        { icon: <CalendarX size={15} />,    color: '#f87171', bg: 'rgba(248,113,113,0.14)', verb: 'удалил(а) мероприятие'      },
}

const FALLBACK_CFG: ActionCfg = {
  icon: <RefreshCw size={15} />,
  color: 'var(--text-muted)',
  bg: 'rgba(255,255,255,0.06)',
  verb: 'выполнил(а) действие',
}

// ── Вспомогательные ──────────────────────────────────────────────────────────

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const d = new Date(date); d.setHours(0, 0, 0, 0)

  if (d.getTime() === today.getTime())     return 'Сегодня'
  if (d.getTime() === yesterday.getTime()) return 'Вчера'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0] ?? '').join('').substring(0, 2).toUpperCase()
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md"
      style={{ color, background: bg, border: `1px solid ${color}33` }}
    >
      {label}
    </span>
  )
}

function ProjectBadge({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
      style={{ color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
    >
      <span style={{ fontSize: 9 }}>📁</span>
      {name}
    </span>
  )
}

function StageBadge({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
      style={{ color: '#c4b5fd', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
    >
      <span style={{ fontSize: 9 }}>⚙</span>
      {name}
    </span>
  )
}

// ── Контекстный блок (под основной строкой) ───────────────────────────────────

type MetaShape = {
  projectName?: string
  stageName?: string
  status?: string
  review_status?: string
  title?: string
  note?: string
}

function ContextBlock({ action, meta }: { action: string; meta: Record<string, unknown> | null }) {
  const m = (meta ?? {}) as MetaShape

  // Стадия — показываем проект + стадию + статус
  if (action === 'stage.status_changed') {
    const st = TASK_STATUS[m.status as string]
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {m.projectName && <ProjectBadge name={m.projectName as string} />}
        {m.stageName   && <StageBadge  name={m.stageName   as string} />}
        {st && <Chip label={st.label} color={st.color} bg={st.bg} />}
      </div>
    )
  }

  if (action === 'stage.review_changed') {
    const rs = REVIEW_STATUS[(m.review_status as string) ?? '']
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {m.projectName && <ProjectBadge name={m.projectName as string} />}
        {m.stageName   && <StageBadge  name={m.stageName   as string} />}
        {rs && <Chip label={rs.label} color={rs.color} bg={rs.bg} />}
      </div>
    )
  }

  // Задача — статус-изменение: показываем название + новый статус
  if (action === 'task.status_changed') {
    const st = TASK_STATUS[m.status as string]
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {m.title && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md"
            style={{ color: '#93c5fd', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
            {m.title as string}
          </span>
        )}
        {st && (
          <>
            <ArrowRight size={10} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            <Chip label={st.label} color={st.color} bg={st.bg} />
          </>
        )}
      </div>
    )
  }

  // Отчёт по задаче
  if (action === 'task.feedback') {
    const st = TASK_STATUS[m.status as string]
    return (
      <div className="mt-1.5 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {m.title && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{ color: '#93c5fd', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
              {m.title as string}
            </span>
          )}
          {st && <Chip label={st.label} color={st.color} bg={st.bg} />}
        </div>
        {m.note && (
          <p className="text-xs italic px-3 py-2 rounded-lg"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            «{m.note as string}»
          </p>
        )}
      </div>
    )
  }

  return null
}

// ── Основной компонент ────────────────────────────────────────────────────────

export default function ActivityFeed({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-dim)' }}>
        <p className="text-sm">Активность пока не зафиксирована</p>
      </div>
    )
  }

  // Группировка по дням
  const groups: { label: string; items: ActivityItem[] }[] = []
  const seen: Record<string, number> = {}

  for (const item of activities) {
    const label = getDayLabel(item.created_at)
    if (seen[label] === undefined) {
      seen[label] = groups.length
      groups.push({ label, items: [] })
    }
    groups[seen[label]].items.push(item)
  }

  return (
    <div className="space-y-10 max-w-2xl">
      {groups.map(group => (
        <div key={group.label}>
          {/* День */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {group.label}
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <div className="space-y-2">
            {group.items.map(item => {
              const cfg = ACTION_CONFIG[item.action] ?? FALLBACK_CFG
              const ini = initials(item.actor.full_name)
              const firstName = item.actor.full_name.split(' ')[0]
              const lastName  = item.actor.full_name.split(' ')[1] ?? ''
              const m = item.meta ?? {}

              // Главный текст события (для project/event/task.created включаем имя прямо в verb)
              let headline = cfg.verb
              if (item.action === 'project.created' && m.name)
                headline = `создал(а) проект «${m.name}»`
              else if ((item.action === 'task.created' || item.action === 'task.updated') && m.title)
                headline = `${cfg.verb} «${m.title}»`
              else if ((item.action === 'event.created' || item.action === 'event.updated') && m.title)
                headline = `${cfg.verb} «${m.title}»`

              const hasContext = ['stage.status_changed','stage.review_changed','task.status_changed','task.feedback'].includes(item.action)

              return (
                <div
                  key={item.id}
                  className="flex gap-3 px-4 py-3 rounded-2xl transition-colors"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${cfg.color}`,
                  }}
                >
                  {/* Иконка действия */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.icon}
                  </div>

                  {/* Содержимое */}
                  <div className="flex-1 min-w-0">
                    {/* Верхняя строка: актор + действие + время */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-snug" style={{ color: 'var(--text)' }}>
                        {/* Аватар */}
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mr-1.5 align-middle flex-shrink-0"
                          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                        >
                          {ini}
                        </span>
                        <span className="font-semibold">{firstName}</span>
                        {lastName && <span className="font-semibold"> {lastName[0]}.</span>}
                        {' '}
                        <span style={{ color: 'var(--text-muted)' }}>{headline}</span>
                      </p>
                      <span
                        className="text-[11px] tabular-nums flex-shrink-0 mt-0.5"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        {formatTime(item.created_at)}
                      </span>
                    </div>

                    {/* Контекстный блок */}
                    {hasContext && <ContextBlock action={item.action} meta={item.meta} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
