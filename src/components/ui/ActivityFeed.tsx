'use client'

import { useState } from 'react'
import {
  PlusCircle, RefreshCw, Trash2, CheckCircle2, MessageSquare,
  Calendar, CalendarPlus, CalendarX, FolderPlus, ArrowRight,
  X, Loader2, MessageCircleQuestion, Lock, Vote, Bell, CalendarClock,
  Paperclip, UserCheck, FileText, ShieldCheck, ListPlus, ListX, MoveRight,
  Play, XCircle, Heart,
} from 'lucide-react'
import { formatNameShort } from '@/lib/utils/name'

export interface ActivityItem {
  id: string
  actor: { id: string; full_name: string }
  entity_type: 'direct_task' | 'project_task' | 'project' | 'stage' | 'event' | 'poll' | 'daily_report'
  entity_id: string
  action: string
  meta: Record<string, unknown> | null
  created_at: string
}

interface Props {
  activities: ActivityItem[]
  /** Опционально — callback удаления записи. Если передан, на карточке появляется иконка trash. */
  onDelete?: (id: string) => Promise<void> | void
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
  // Дейли-отчёты
  'daily.submitted':                   { icon: <FileText size={15} />,     color: 'var(--green)',      bg: 'var(--green-glow)',                                                       verb: 'сдал(а) дейли-отчёт'             },
  'daily.updated':                     { icon: <RefreshCw size={15} />,    color: '#fbbf24',           bg: 'rgba(251,191,36,0.14)',                                                   verb: 'обновил(а) дейли-отчёт'          },
  'daily.reaction_added':              { icon: <Heart size={15} />,        color: '#f472b6',           bg: 'rgba(244,114,182,0.14)',                                                  verb: 'оценил(а) дейли-отчёт'           },
  'direct_task.completed_via_daily':   { icon: <CheckCircle2 size={15} />, color: 'var(--green)',      bg: 'var(--green-glow)',                                                       verb: 'закрыл(а) поручение через дейли' },
  'project_task.completed_via_daily':  { icon: <CheckCircle2 size={15} />, color: 'var(--green)',      bg: 'var(--green-glow)',                                                       verb: 'завершил(а) задачу через дейли'  },
  'stage.completed_via_daily':         { icon: <CheckCircle2 size={15} />, color: 'var(--green)',      bg: 'var(--green-glow)',                                                       verb: 'завершил(а) этап через дейли'    },
  // Проекты
  'project.created':              { icon: <FolderPlus size={15} />,   color: '#818cf8',     bg: 'rgba(99,102,241,0.14)',  verb: 'создал(а) проект'           },
  'project.updated':              { icon: <RefreshCw size={15} />,    color: '#fbbf24',     bg: 'rgba(251,191,36,0.14)',  verb: 'обновил(а) проект'          },
  'project.deleted':              { icon: <Trash2 size={15} />,       color: '#f87171',     bg: 'rgba(248,113,113,0.14)', verb: 'удалил(а) проект'           },
  'project.stage_moved':          { icon: <MoveRight size={15} />,    color: '#a78bfa',     bg: 'rgba(139,92,246,0.14)',  verb: 'переместил(а) этап'         },
  // Прямые поручения
  'direct_task.created':          { icon: <PlusCircle size={15} />,   color: 'var(--color-warn)', bg: 'rgba(245,158,11,0.14)',  verb: 'выдал(а) поручение'         },
  'direct_task.updated':          { icon: <RefreshCw size={15} />,    color: '#fbbf24',     bg: 'rgba(251,191,36,0.14)',  verb: 'обновил(а) поручение'       },
  'direct_task.deleted':          { icon: <Trash2 size={15} />,       color: '#f87171',     bg: 'rgba(248,113,113,0.14)', verb: 'удалил(а) поручение'        },
  'direct_task.status_changed':   { icon: <CheckCircle2 size={15} />, color: 'var(--green)', bg: 'var(--green-glow)',     verb: 'изменил(а) статус поручения' },
  'direct_task.feedback':         { icon: <MessageSquare size={15} />,color: '#fb923c',     bg: 'rgba(251,146,60,0.14)',  verb: 'отчитался(ась) по поручению' },
  'direct_task.accepted':         { icon: <Play size={15} />,         color: 'var(--green)', bg: 'var(--green-glow)',     verb: 'принял(а) поручение в работу' },
  'direct_task.rejected':         { icon: <XCircle size={15} />,      color: '#f87171',     bg: 'rgba(248,113,113,0.14)', verb: 'отклонил(а) поручение'      },
  // Проектные задачи
  'project_task.created':         { icon: <PlusCircle size={15} />,   color: '#60a5fa',     bg: 'rgba(59,130,246,0.14)',  verb: 'создал(а) задачу'           },
  'project_task.updated':         { icon: <RefreshCw size={15} />,    color: '#fbbf24',     bg: 'rgba(251,191,36,0.14)',  verb: 'обновил(а) задачу'          },
  'project_task.deleted':         { icon: <Trash2 size={15} />,       color: '#f87171',     bg: 'rgba(248,113,113,0.14)', verb: 'удалил(а) задачу'           },
  'project_task.status_changed':  { icon: <CheckCircle2 size={15} />, color: 'var(--green)', bg: 'var(--green-glow)',     verb: 'изменил(а) статус задачи'   },
  'project_task.feedback':        { icon: <MessageSquare size={15} />,color: '#fb923c',     bg: 'rgba(251,146,60,0.14)',  verb: 'отчитался(ась) по задаче'   },
  'project_task.moved':           { icon: <ArrowRight size={15} />,   color: '#a78bfa',     bg: 'rgba(139,92,246,0.14)',  verb: 'переместил(а) задачу'       },
  'project_task.accepted':        { icon: <Play size={15} />,         color: 'var(--green)', bg: 'var(--green-glow)',     verb: 'принял(а) задачу в работу'  },
  'project_task.rejected':        { icon: <XCircle size={15} />,      color: '#f87171',     bg: 'rgba(248,113,113,0.14)', verb: 'отклонил(а) задачу'         },
  // Этапы
  'stage.created':                     { icon: <PlusCircle size={15} />,   color: '#818cf8', bg: 'rgba(99,102,241,0.14)',  verb: 'создал(а) этап'                  },
  'stage.deleted':                     { icon: <Trash2 size={15} />,       color: '#f87171', bg: 'rgba(248,113,113,0.14)', verb: 'удалил(а) этап'                  },
  'stage.status_changed':              { icon: <RefreshCw size={15} />,    color: '#a78bfa', bg: 'rgba(139,92,246,0.14)',  verb: 'обновил(а) статус стадии'        },
  'stage.review_changed':              { icon: <ShieldCheck size={15} />,  color: 'var(--green)', bg: 'var(--green-glow)', verb: 'проверил(а) стадию'              },
  'stage.deadline_changed':            { icon: <Calendar size={15} />,     color: '#fbbf24', bg: 'rgba(251,191,36,0.14)',  verb: 'изменил(а) дедлайн этапа'        },
  'stage.assignee_changed':            { icon: <UserCheck size={15} />,    color: '#a78bfa', bg: 'rgba(139,92,246,0.14)',  verb: 'назначил(а) ответственного'      },
  'stage.notes_updated':               { icon: <FileText size={15} />,     color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)', verb: 'обновил(а) заметки этапа' },
  'stage.checklist_item_added':        { icon: <ListPlus size={15} />,     color: '#60a5fa', bg: 'rgba(59,130,246,0.14)',  verb: 'добавил(а) пункт в чек-лист'     },
  'stage.checklist_item_removed':      { icon: <ListX size={15} />,        color: '#f87171', bg: 'rgba(248,113,113,0.14)', verb: 'удалил(а) пункт чек-листа'       },
  'stage.checklist_item_renamed':      { icon: <FileText size={15} />,     color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)', verb: 'переименовал(а) пункт чек-листа' },
  'stage.checklist_item_completed':    { icon: <CheckCircle2 size={15} />, color: 'var(--green)', bg: 'var(--green-glow)', verb: 'отметил(а) пункт чек-листа'      },
  'stage.checklist_item_uncompleted':  { icon: <RefreshCw size={15} />,    color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)', verb: 'снял(а) отметку с пункта' },
  'stage.document_attached':           { icon: <Paperclip size={15} />,    color: '#60a5fa', bg: 'rgba(59,130,246,0.14)',  verb: 'прикрепил(а) документ к этапу'   },
  'stage.document_removed':            { icon: <Trash2 size={15} />,       color: '#f87171', bg: 'rgba(248,113,113,0.14)', verb: 'удалил(а) документ этапа'        },
  // Мероприятия
  'event.created':                { icon: <CalendarPlus size={15} />, color: '#60a5fa',     bg: 'rgba(59,130,246,0.14)',  verb: 'создал(а) мероприятие'      },
  'event.updated':                { icon: <Calendar size={15} />,     color: '#fbbf24',     bg: 'rgba(251,191,36,0.14)',  verb: 'обновил(а) мероприятие'     },
  'event.deleted':                { icon: <CalendarX size={15} />,    color: '#f87171',     bg: 'rgba(248,113,113,0.14)', verb: 'удалил(а) мероприятие'      },
  // Опросы
  'poll.created':                 { icon: <MessageCircleQuestion size={15} />, color: '#22d3ee', bg: 'rgba(34,211,238,0.14)', verb: 'создал(а) опрос'   },
  'poll.updated':                 { icon: <RefreshCw size={15} />,             color: '#fbbf24', bg: 'rgba(251,191,36,0.14)', verb: 'обновил(а) опрос'  },
  'poll.responded':               { icon: <Vote size={15} />,                  color: 'var(--green)', bg: 'var(--green-glow)', verb: 'ответил(а) на опрос' },
  'poll.closed':                  { icon: <Lock size={15} />,                  color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)', verb: 'закрыл(а) опрос' },
  'poll.deleted':                 { icon: <Trash2 size={15} />,                color: '#f87171', bg: 'rgba(248,113,113,0.14)', verb: 'удалил(а) опрос'   },
  'poll.reminded':                { icon: <Bell size={15} />,                  color: 'var(--color-warn)', bg: 'color-mix(in oklab, var(--color-warn) 12%, transparent)', verb: 'напомнил(а) об опросе' },
  'poll.extended':                { icon: <CalendarClock size={15} />,         color: '#60a5fa', bg: 'rgba(59,130,246,0.14)', verb: 'продлил(а) дедлайн опроса' },
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
  return date.toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'long' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ru-RU', { timeZone: 'Asia/Oral', hour: '2-digit', minute: '2-digit' })
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

export default function ActivityFeed({ activities, onDelete }: Props) {
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
            {group.items.map(item => (
              <ActivityCard key={item.id} item={item} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Карточка одной записи (со встроенной inline-confirm для удаления) ────────

function ActivityCard({ item, onDelete }: { item: ActivityItem; onDelete?: (id: string) => Promise<void> | void }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const cfg = ACTION_CONFIG[item.action] ?? FALLBACK_CFG
  const ini = initials(item.actor.full_name)
  const shortName = formatNameShort(item.actor.full_name)
  const m = item.meta ?? {}

  let headline = cfg.verb
  if (item.action === 'project.created' && m.name)
    headline = `создал(а) проект «${m.name}»`
  else if ((item.action === 'direct_task.created' || item.action === 'direct_task.updated' || item.action === 'project_task.created' || item.action === 'project_task.updated') && m.title)
    headline = `${cfg.verb} «${m.title}»`
  else if ((item.action === 'event.created' || item.action === 'event.updated') && m.title)
    headline = `${cfg.verb} «${m.title}»`

  const hasContext = ['stage.status_changed', 'stage.review_changed', 'direct_task.status_changed', 'project_task.status_changed', 'direct_task.feedback', 'project_task.feedback'].includes(item.action)

  async function handleConfirmDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete(item.id)
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div
      className="flex gap-3 px-4 py-3 rounded-2xl transition-colors group"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${cfg.color}`,
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {cfg.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-snug" style={{ color: 'var(--text)' }}>
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mr-1.5 align-middle flex-shrink-0"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              {ini}
            </span>
            <span className="font-semibold">{shortName}</span>
            {' '}
            <span style={{ color: 'var(--text-muted)' }}>{headline}</span>
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[11px] tabular-nums mt-0.5" style={{ color: 'var(--text-dim)' }}>
              {formatTime(item.created_at)}
            </span>
            {onDelete && !confirming && (
              <button
                onClick={() => setConfirming(true)}
                className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                title="Удалить запись"
                style={{ color: 'var(--text-dim)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-danger)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklab, var(--color-danger) 10%, transparent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {hasContext && <ContextBlock action={item.action} meta={item.meta} />}

        {confirming && (
          <div
            className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)', border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)' }}
          >
            <span style={{ color: 'var(--color-danger)' }}>Удалить запись?</span>
            <button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="ml-auto px-2 py-0.5 rounded-md text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
              style={{ background: 'color-mix(in oklab, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in oklab, var(--color-danger) 30%, transparent)' }}
            >
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Удалить
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-0.5 rounded-md text-xs"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
