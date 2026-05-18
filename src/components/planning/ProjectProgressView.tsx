'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  Activity, AlertCircle, ArrowRightLeft, ArrowUpRight, Calendar, Check,
  CheckCircle2, ClipboardList, FileText, FolderPlus, History, Loader2,
  MessageSquare, Paperclip, Plus, RotateCcw, ShieldCheck, Trash2,
  UserCheck, XCircle,
} from 'lucide-react'
import {
  loadMoreProjectActivity,
  type ProjectActivityEntry,
} from '@/lib/actions/activity'
import { createClient } from '@/lib/supabase/client'

type Props = {
  projectId: string
  initial: ProjectActivityEntry[]
  pageSize?: number
}

// ─── Категории для фильтр-чипов ─────────────────────────────────────────────
type FilterKey = 'all' | 'status' | 'tasks' | 'stages' | 'docs' | 'checklist'

function entryCategory(e: ProjectActivityEntry): Exclude<FilterKey, 'all'> {
  if (e.action.endsWith('.status_changed_audit')
      || e.action === 'project_task.accepted'
      || e.action === 'project_task.rejected'
      || e.action === 'project_task.feedback'
      || e.action === 'stage.review_changed') return 'status'
  if (e.action.includes('document'))         return 'docs'
  if (e.action.includes('checklist_item'))   return 'checklist'
  if (e.entity_type === 'project_task')      return 'tasks'
  return 'stages' // всё прочее по этапу/проекту
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'Все' },
  { key: 'status',    label: 'Статусы' },
  { key: 'tasks',     label: 'Задачи' },
  { key: 'stages',    label: 'Этапы' },
  { key: 'docs',      label: 'Документы' },
  { key: 'checklist', label: 'Чек-лист' },
]

// ─── Визуальные конфиги для action ────────────────────────────────────────
type ActionView = {
  icon: React.ReactNode
  tone: 'green' | 'info' | 'warn' | 'danger' | 'muted' | 'purple'
  describe: (meta: Record<string, unknown> | null) => React.ReactNode
}

function tone(name: string): string {
  switch (name) {
    case 'green':  return 'var(--color-green)'
    case 'info':   return 'var(--color-info)'
    case 'warn':   return 'var(--color-warn)'
    case 'danger': return 'var(--color-danger)'
    case 'purple': return 'var(--color-purple)'
    case 'muted':
    default:       return 'var(--color-text-muted)'
  }
}

const STAGE_STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидание', in_progress: 'В работе', completed: 'Завершён', blocked: 'Заблокирован',
}
const TASK_STATUS_LABEL: Record<string, string> = {
  todo: 'Не принято', in_progress: 'В работе', review: 'На проверке', done: 'Завершено', failed: 'Не завершено',
}
const REVIEW_LABEL: Record<string, string> = {
  pending_review: 'На проверке', approved: 'Одобрено', revision_needed: 'На доработку',
}

function s(meta: Record<string, unknown> | null, key: string): string | null {
  if (!meta) return null
  const v = meta[key]
  return typeof v === 'string' ? v : null
}

function arrow(from: string | null, to: string | null, dict: Record<string, string>) {
  if (!from && !to) return null
  return (
    <>
      {from && (
        <span style={{ color: 'var(--color-text-dim)' }}>{dict[from] ?? from}</span>
      )}
      {from && to && <span style={{ color: 'var(--color-text-dim)' }}> → </span>}
      {to && (
        <span style={{ color: 'var(--color-text)' }}>{dict[to] ?? to}</span>
      )}
    </>
  )
}

// Маппинг action → визуальный вид и текст.
// Триггерные status_changed_audit показываем (более полные), ручные status_changed скрываем.
const ACTION_MAP: Record<string, ActionView> = {
  // ── Проект ─────────────────────────────────────────────────────────────
  'project.created':         { icon: <FolderPlus  size={14} />, tone: 'green',  describe: m => <>создал проект «<b>{s(m, 'name') ?? '—'}</b>»</> },
  'project.deleted':         { icon: <Trash2      size={14} />, tone: 'danger', describe: m => <>удалил проект «<b>{s(m, 'name') ?? '—'}</b>»</> },
  'project.status_changed':  { icon: <ArrowRightLeft size={14} />, tone: 'info',   describe: m => <>изменил статус проекта: {arrow(s(m, 'from'), s(m, 'to'), {})}</> },
  'project.renamed':         { icon: <FileText    size={14} />, tone: 'muted',  describe: m => <>переименовал проект {arrow(s(m, 'from'), s(m, 'to'), {})}</> },
  'project.stage_moved':     { icon: <ArrowUpRight size={14} />, tone: 'info',   describe: m => {
    const name = s(m, 'stage_name') ?? s(m, 'stage_key')
    return <>переместил проект {name ? <>на этап «<b>{name}</b>»</> : 'на другой этап'}</>
  } },

  // ── Этап ───────────────────────────────────────────────────────────────
  'stage.created':                     { icon: <Plus           size={14} />, tone: 'green',  describe: m => <>создал этап «<b>{s(m, 'name') ?? '—'}</b>»</> },
  'stage.deleted':                     { icon: <Trash2         size={14} />, tone: 'danger', describe: m => <>удалил этап «<b>{s(m, 'name') ?? '—'}</b>»</> },
  'stage.status_changed_audit':        { icon: <ArrowRightLeft size={14} />, tone: 'info',   describe: m => <>этап «<b>{s(m, 'name') ?? '—'}</b>»: {arrow(s(m, 'from_status'), s(m, 'to_status'), STAGE_STATUS_LABEL)}</> },
  'stage.review_changed':              { icon: <ShieldCheck    size={14} />, tone: 'warn',   describe: m => <>проверка этапа «<b>{s(m, 'name') ?? '—'}</b>»: <b>{REVIEW_LABEL[s(m, 'review_status') ?? ''] ?? s(m, 'review_status') ?? '—'}</b></> },
  'stage.deadline_changed':            { icon: <Calendar       size={14} />, tone: 'muted',  describe: m => <>изменил дедлайн этапа «<b>{s(m, 'name') ?? '—'}</b>» на <span className="num">{s(m, 'deadline') ?? '—'}</span></> },
  'stage.assignee_changed':            { icon: <UserCheck      size={14} />, tone: 'purple', describe: m => <>назначил ответственного на этап «<b>{s(m, 'name') ?? '—'}</b>»</> },
  'stage.notes_updated':               { icon: <FileText       size={14} />, tone: 'muted',  describe: m => <>обновил заметки этапа «<b>{s(m, 'name') ?? '—'}</b>»</> },
  'stage.checklist_item_added':        { icon: <Plus           size={14} />, tone: 'muted',  describe: m => <>добавил пункт чек-листа «<b>{s(m, 'label') ?? '—'}</b>»</> },
  'stage.checklist_item_removed':      { icon: <Trash2         size={14} />, tone: 'danger', describe: m => <>удалил пункт чек-листа «<b>{s(m, 'label') ?? '—'}</b>»</> },
  'stage.checklist_item_completed':    { icon: <CheckCircle2   size={14} />, tone: 'green',  describe: m => <>отметил пункт «<b>{s(m, 'label') ?? '—'}</b>»</> },
  'stage.checklist_item_uncompleted':  { icon: <RotateCcw      size={14} />, tone: 'warn',   describe: m => {
    const prev = s(m, 'previous_completed_by_name')
    return <>снял отметку с пункта «<b>{s(m, 'label') ?? '—'}</b>»{prev && <> (отмечал {prev})</>}</>
  } },
  'stage.document_attached':           { icon: <Paperclip      size={14} />, tone: 'info',   describe: m => <>прикрепил документ «<b>{s(m, 'document_name') ?? '—'}</b>»</> },
  'stage.document_removed':            { icon: <Trash2         size={14} />, tone: 'danger', describe: m => <>удалил документ «<b>{s(m, 'document_name') ?? '—'}</b>»</> },

  // ── Задачи проекта ─────────────────────────────────────────────────────
  'project_task.created':              { icon: <ClipboardList  size={14} />, tone: 'green',  describe: m => <>создал задачу «<b>{s(m, 'title') ?? '—'}</b>»</> },
  'project_task.deleted':              { icon: <Trash2         size={14} />, tone: 'danger', describe: m => <>удалил задачу «<b>{s(m, 'title') ?? '—'}</b>»</> },
  'project_task.moved':                { icon: <ArrowUpRight   size={14} />, tone: 'muted',  describe: () => <>переместил задачу в другой этап</> },
  'project_task.status_changed_audit': { icon: <ArrowRightLeft size={14} />, tone: 'info',   describe: m => <>задача «<b>{s(m, 'title') ?? '—'}</b>»: {arrow(s(m, 'from_status'), s(m, 'to_status'), TASK_STATUS_LABEL)}</> },
  'project_task.accepted':             { icon: <Check          size={14} />, tone: 'green',  describe: m => <>принял в работу: «<b>{s(m, 'title') ?? '—'}</b>»</> },
  'project_task.rejected':             { icon: <XCircle        size={14} />, tone: 'danger', describe: m => <>отклонил задачу «<b>{s(m, 'title') ?? '—'}</b>»{s(m, 'reason') && <>: {s(m, 'reason')}</>}</> },
  'project_task.feedback':             { icon: <MessageSquare  size={14} />, tone: 'muted',  describe: m => <>оставил комментарий к «<b>{s(m, 'title') ?? '—'}</b>»{s(m, 'note') && <>: {s(m, 'note')}</>}</> },
}

const HIDDEN_ACTIONS = new Set<string>([
  // Ручные status_changed дублируют триггерный *_audit — прячем, иначе шум.
  'project_task.status_changed',
  'stage.status_changed',
])

// ─── Группировка по дням ──────────────────────────────────────────────────
function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Oral', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    timeZone: 'Asia/Oral', hour: '2-digit', minute: '2-digit',
  })
}

// ─── Главный компонент ───────────────────────────────────────────────────
export default function ProjectProgressView({ projectId, initial, pageSize = 50 }: Props) {
  const [entries, setEntries] = useState<ProjectActivityEntry[]>(initial)
  const [done, setDone] = useState(initial.length < pageSize)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [filter, setFilter] = useState<FilterKey>('all')

  // Счётчики на чипах — по всем загруженным записям, не по отфильтрованным,
  // иначе при выборе чипа все остальные счётчики обнулятся.
  const counts = useMemo(() => {
    const m: Record<FilterKey, number> = { all: 0, status: 0, tasks: 0, stages: 0, docs: 0, checklist: 0 }
    for (const e of entries) {
      if (HIDDEN_ACTIONS.has(e.action)) continue
      m.all++
      m[entryCategory(e)]++
    }
    return m
  }, [entries])

  const groups = useMemo(() => {
    const visible = entries.filter(e => {
      if (HIDDEN_ACTIONS.has(e.action)) return false
      if (filter !== 'all' && entryCategory(e) !== filter) return false
      return true
    })
    const map = new Map<string, ProjectActivityEntry[]>()
    for (const e of visible) {
      const key = dayKey(e.created_at)
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [entries, filter])

  function handleLoadMore() {
    startTransition(async () => {
      const result = await loadMoreProjectActivity(projectId, entries.length, pageSize)
      if (result.error) { setError(result.error); return }
      setEntries(prev => [...prev, ...result.entries])
      if (result.entries.length < pageSize) setDone(true)
    })
  }

  // ── Realtime ─────────────────────────────────────────────────────────────
  // Подписываемся на INSERT в activity_log (RLS уже фильтрует — мы получим
  // только события доступных проектов/этапов/задач). На каждый event делаем
  // debounced рефетч первых pageSize записей и мержим с уже загруженными.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    function scheduleRefresh() {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(async () => {
        const result = await loadMoreProjectActivity(projectId, 0, pageSize)
        if (result.error || !result.entries.length) return
        setEntries(prev => {
          const seen = new Set(prev.map(e => e.id))
          const fresh = result.entries.filter(e => !seen.has(e.id))
          if (fresh.length === 0) return prev
          return [...fresh, ...prev]
        })
      }, 600)
    }

    const channel = supabase
      .channel(`project-activity-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          const row = payload.new as { entity_type?: string }
          // Дешёвый фильтр на клиенте — отсечь чужие entity_type'ы.
          if (row.entity_type !== 'project'
              && row.entity_type !== 'stage'
              && row.entity_type !== 'project_task') return
          scheduleRefresh()
        },
      )
      .subscribe()

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [projectId, pageSize])

  if (entries.length === 0) {
    return (
      <div className="card py-16 text-center">
        <History size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-dim)' }} />
        <p className="font-medium" style={{ color: 'var(--color-text-muted)' }}>Истории пока нет</p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-dim)' }}>
          Здесь будут отображаться действия по проекту: смена статусов, документы, чек-лист
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Фильтр-чипы по типу события. Счётчики берутся по всем загруженным записям. */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => {
          const active = filter === f.key
          const cnt = counts[f.key]
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
              style={{
                background: active
                  ? 'color-mix(in oklab, var(--color-green) 15%, transparent)'
                  : 'var(--color-surface-2)',
                color: active ? 'var(--color-green)' : 'var(--color-text-muted)',
                border: `1px solid ${active
                  ? 'color-mix(in oklab, var(--color-green) 30%, transparent)'
                  : 'var(--color-border)'}`,
              }}
            >
              {f.label}
              <span className="num text-[10px]" style={{
                color: active ? 'var(--color-green)' : 'var(--color-text-dim)',
                opacity: cnt === 0 ? 0.5 : 1,
              }}>
                {cnt}
              </span>
            </button>
          )
        })}
      </div>

      {groups.length === 0 && filter !== 'all' && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-dim)' }}>
          Нет событий в этой категории
        </p>
      )}

      {groups.map(([day, items]) => (
        <section key={day}>
          <h3
            className="text-xs uppercase tracking-wider mb-2 sticky top-0 py-2 px-1 -mx-1"
            style={{
              color: 'var(--color-text-dim)',
              background: 'linear-gradient(to bottom, var(--color-bg) 70%, transparent)',
              backdropFilter: 'blur(2px)',
              zIndex: 1,
            }}
          >
            {day}
          </h3>
          <ul className="space-y-1.5">
            {items.map(entry => <LogEntry key={entry.id} entry={entry} />)}
          </ul>
        </section>
      ))}

      {error && (
        <div
          className="rounded-xl px-3 py-2 text-sm flex items-center gap-2"
          style={{
            background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
            border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {!done && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={pending}
            className="text-sm px-4 py-2 rounded-xl flex items-center gap-2 disabled:opacity-40"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            Показать ещё
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Одна запись лога ────────────────────────────────────────────────────
function LogEntry({ entry }: { entry: ProjectActivityEntry }) {
  const view = ACTION_MAP[entry.action]
  const fallbackTone = entry.action.endsWith('.deleted') ? 'danger' : 'muted'
  const color = tone(view?.tone ?? fallbackTone)
  const description = view
    ? view.describe(entry.meta)
    : <span style={{ color: 'var(--color-text-dim)' }}>{entry.action}</span>

  return (
    <li
      className="flex items-start gap-3 px-3 py-2 rounded-lg"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: `color-mix(in oklab, ${color} 12%, transparent)`,
          color,
          border: `1px solid color-mix(in oklab, ${color} 25%, transparent)`,
        }}
      >
        {view?.icon ?? <Activity size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug break-words" style={{ color: 'var(--color-text)' }}>
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {entry.actor_name ?? 'Система'}
          </span>{' '}
          {description}
        </p>
        <p className="text-xs mt-0.5 num" style={{ color: 'var(--color-text-dim)' }}>
          {formatTime(entry.created_at)}
        </p>
      </div>
      {entry.action.endsWith('.rejected') && <RotateCcw size={12} className="opacity-0" />}
    </li>
  )
}
