'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send, User, AlertTriangle, Calendar, MessageSquare,
  Check, Loader2, Search, X, Gauge, AlertCircle, RotateCcw,
} from 'lucide-react'
import { submitDirectTaskFeedback, markDirectTaskFailed } from '@/lib/actions/direct-tasks'
import { acceptHandover, rejectHandover } from '@/lib/actions/handover'
import { createClient } from '@/lib/supabase/client'
import { formatNameShort } from '@/lib/utils/name'

export type WipBadge = {
  active: number
  limit: number
  state: 'ok' | 'warning' | 'over'
}

export type Assignment = {
  id: string
  title: string
  description: string | null
  employee_note: string | null
  status: string
  priority: string
  deadline: string | null
  creator: { full_name: string } | null
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  low:      { color: 'var(--text-muted)', bg: 'var(--surface-2)',      label: 'Низкий'    },
  medium:   { color: '#60a5fa',           bg: 'rgba(59,130,246,0.1)',  label: 'Средний'   },
  high:     { color: '#fb923c',           bg: 'rgba(249,115,22,0.1)',  label: 'Высокий'   },
  critical: { color: '#f87171',           bg: 'rgba(239,68,68,0.1)',   label: 'Критичный' },
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  todo:        { color: 'var(--text-muted)', bg: 'var(--surface-2)',       border: 'var(--border-2)',         label: 'Не принято'   },
  in_progress: { color: '#60a5fa',           bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.3)',    label: 'В работе'     },
  review:      { color: '#f59e0b',           bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.3)',    label: 'На проверке'  },
  done:        { color: 'var(--green)',      bg: 'var(--green-glow)',      border: 'rgba(34,197,94,0.3)',     label: 'Завершено'    },
  failed:      { color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',     label: 'Не завершено' },
}

const STATUS_TABS = [
  { key: 'active', label: 'Активные'       },
  { key: 'review', label: 'На проверке'    },
  { key: 'done',   label: 'Завершено'      },
  { key: 'failed', label: 'Не завершено'   },
  { key: 'all',    label: 'Все'            },
]

export default function MyAssignmentsList({
  initialTasks,
  loadMore,
  pageSize,
  userId,
  wip,
}: {
  initialTasks: Assignment[]
  loadMore?: (page: number) => Promise<Assignment[]>
  pageSize?: number
  userId: string
  wip?: WipBadge | null
}) {
  const [tasks, setTasks]       = useState(initialTasks)
  const [tab, setTab]           = useState('active')
  const [search, setSearch]     = useState('')
  const router                  = useRouter()
  const supabaseRef             = useRef(createClient())

  // Пагинация
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(!!loadMore && initialTasks.length === (pageSize ?? 0))
  const [loadingMore, startLoadMore] = useTransition()

  // Realtime: ловим UPDATE/DELETE по своим поручениям (директор правит/удаляет) +
  // INSERT в junction (новые поручения и добавление вторым исполнителем) — на них
  // делаем router.refresh(), т.к. ленивый INSERT не даёт полную строку direct_tasks.
  useEffect(() => {
    const supabase = supabaseRef.current

    const channel = supabase
      .channel(`my-assignments-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_tasks',
          filter: `assignee_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<Assignment> & { id: string }
          setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'direct_tasks',
          filter: `assignee_id=eq.${userId}`,
        },
        (payload) => {
          setTasks(prev => prev.filter(t => t.id !== (payload.old as { id: string }).id))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_task_assignees',
          filter: `profile_id=eq.${userId}`,
        },
        () => { router.refresh() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, router])

  function handleLoadMore() {
    if (!loadMore || !pageSize) return
    startLoadMore(async () => {
      const next = await loadMore(page)
      setTasks(prev => {
        const seen = new Set(prev.map(t => t.id))
        return [...prev, ...next.filter(t => !seen.has(t.id))]
      })
      setPage(p => p + 1)
      if (next.length < pageSize) setHasMore(false)
    })
  }

  const filtered = tasks.filter(t => {
    if (tab === 'active' && (t.status === 'done' || t.status === 'review' || t.status === 'failed')) return false
    if (tab === 'review' && t.status !== 'review') return false
    if (tab === 'done'   && t.status !== 'done')   return false
    if (tab === 'failed' && t.status !== 'failed') return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts: Record<string, number> = { all: tasks.length, done: 0, review: 0, failed: 0, active: 0 }
  for (const t of tasks) {
    if (t.status === 'done')        counts.done++
    else if (t.status === 'review') counts.review++
    else if (t.status === 'failed') counts.failed++
    else                            counts.active++
  }

  function handleUpdated(id: string, patch: Partial<Assignment>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  if (tasks.length === 0) {
    return (
      <div className="card py-20 text-center">
        <Send size={40} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
        <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Поручений пока нет</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Руководитель ещё не назначил вам задания</p>
      </div>
    )
  }

  const wipColor = wip?.state === 'over'    ? '#f87171'
                 : wip?.state === 'warning' ? '#f59e0b'
                 :                            'var(--green)'
  const wipBg    = wip?.state === 'over'    ? 'rgba(239,68,68,0.1)'
                 : wip?.state === 'warning' ? 'rgba(245,158,11,0.1)'
                 :                            'var(--green-glow)'
  const wipBorder = wip?.state === 'over'    ? 'rgba(239,68,68,0.3)'
                  : wip?.state === 'warning' ? 'rgba(245,158,11,0.3)'
                  :                            'rgba(34,197,94,0.25)'

  return (
    <div className="space-y-4">
      {/* WIP-индикатор: показываем когда в работе хотя бы что-то */}
      {wip && wip.active > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
          style={{ background: wipBg, border: `1px solid ${wipBorder}` }}>
          <Gauge size={14} style={{ color: wipColor }} />
          <span className="text-sm font-semibold" style={{ color: wipColor }}>
            В работе: {wip.active} из {wip.limit}
          </span>
          {wip.state === 'over' && (
            <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
              · превышен лимит — заверши одно из текущих
            </span>
          )}
          {wip.state === 'warning' && (
            <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
              · приближается к лимиту
            </span>
          )}
        </div>
      )}

      {/* Фильтры */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {/* Табы */}
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto scroll-x-hidden flex-shrink-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {STATUS_TABS.map(t => {
            const active = tab === t.key
            const cnt = counts[t.key] ?? 0
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  background: active ? 'var(--surface-2)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-dim)',
                  border: active ? '1px solid var(--border-2)' : '1px solid transparent',
                }}>
                {t.label}
                {t.key === 'review' && cnt > 0 && (
                  <span className="w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                    style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                    {cnt}
                  </span>
                )}
                {t.key === 'failed' && cnt > 0 && (
                  <span className="w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                    style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--color-danger)' }}>
                    {cnt}
                  </span>
                )}
                {t.key !== 'review' && t.key !== 'failed' && (
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{cnt}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Поиск */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="bg-transparent outline-none text-sm flex-1"
            style={{ color: 'var(--text)' }} />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--text-dim)' }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Список */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center rounded-2xl" style={{ border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Нет поручений по этому фильтру</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map(task => (
            <AssignmentCard key={task.id} task={task} onUpdated={patch => handleUpdated(task.id, patch)} />
          ))}
        </div>
      )}

      {/* «Загрузить ещё» — только когда нет фильтров, чтобы не «терять» отфильтрованные */}
      {hasMore && tab === 'all' && !search && (
        <div className="flex justify-center mt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                       bg-surface border border-border text-text-muted
                       hover:bg-surface-2 hover:border-border-2 hover:text-text
                       disabled:opacity-50 disabled:cursor-wait transition-colors"
          >
            {loadingMore ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Загружаем…
              </>
            ) : (
              'Загрузить ещё'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Карточка поручения ───────────────────────────────────────────────────────
type FeedbackTarget = 'done' | 'comment' | 'reject' | 'fail'

function AssignmentCard({ task, onUpdated }: {
  task: Assignment
  onUpdated: (patch: Partial<Assignment>) => void
}) {
  const today     = new Date()
  const isOverdue = task.deadline && new Date(task.deadline) < today
    && task.status !== 'done' && task.status !== 'failed'

  const [optimisticStatus, setOptimisticStatus] = useState(task.status)
  const [optimisticNote,   setOptimisticNote]   = useState(task.employee_note ?? '')
  const [showFeedback,     setShowFeedback]     = useState(false)
  const [feedbackText,     setFeedbackText]     = useState('')
  const [feedbackTarget,   setFeedbackTarget]   = useState<FeedbackTarget>('comment')
  const [pending, startTransition]              = useTransition()

  function openFeedback(target: FeedbackTarget) {
    setFeedbackTarget(target)
    setFeedbackText('')
    setShowFeedback(true)
  }

  const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
  const sc = STATUS_CONFIG[optimisticStatus]  ?? STATUS_CONFIG.todo

  const borderColor = optimisticStatus === 'done'
    ? 'rgba(34,197,94,0.3)'
    : optimisticStatus === 'failed'
    ? 'rgba(239,68,68,0.35)'
    : optimisticStatus === 'review'
    ? 'rgba(245,158,11,0.35)'
    : isOverdue
    ? 'rgba(239,68,68,0.3)'
    : 'rgba(245,158,11,0.2)'

  function rollback(prevStatus: string, prevNote: string | null) {
    setOptimisticStatus(prevStatus)
    setOptimisticNote(prevNote ?? '')
    onUpdated({ status: prevStatus, employee_note: prevNote })
  }

  function handleAccept() {
    const prevStatus = optimisticStatus
    setOptimisticStatus('in_progress')
    onUpdated({ status: 'in_progress' })
    startTransition(async () => {
      const result = await acceptHandover('direct', task.id)
      if (result.error) rollback(prevStatus, optimisticNote)
    })
  }

  // Лейблы/тексты формы зависят от того, ЧТО мы сейчас отправляем.
  const isPostActionMode = optimisticStatus === 'done' || optimisticStatus === 'review' || optimisticStatus === 'failed'
  const feedbackFormTitle  =
    feedbackTarget === 'done'    ? 'Опишите, что было сделано' :
    feedbackTarget === 'reject'  ? 'Почему отказываетесь от поручения?' :
    feedbackTarget === 'fail'    ? 'Почему не удалось завершить?' :
                                   'Дополните или уточните комментарий'
  const feedbackPlaceholder =
    feedbackTarget === 'done'    ? 'Что именно выполнено? Какие материалы / результаты передаёте?' :
    feedbackTarget === 'reject'  ? 'Напишите причину отказа — её увидит руководитель' :
    feedbackTarget === 'fail'    ? 'Напишите, что помешало завершить' :
                                   'Напишите комментарий, уточнение или дополнение...'

  function handleFeedbackSubmit() {
    if (!feedbackText.trim()) return
    const note = feedbackText.trim()
    const prevStatus = optimisticStatus
    const prevNote   = optimisticNote

    if (feedbackTarget === 'reject') {
      // Отклонение через handover — задача возвращается в очередь, assignee = NULL.
      // У сотрудника она пропадает из списка благодаря realtime UPDATE.
      setShowFeedback(false); setFeedbackText('')
      startTransition(async () => {
        const result = await rejectHandover('direct', task.id, note)
        if (result.error) { /* откатывать тут нечего — задача либо ушла, либо нет */ }
      })
      return
    }

    if (feedbackTarget === 'fail') {
      setOptimisticStatus('failed')
      setOptimisticNote(note)
      onUpdated({ status: 'failed', employee_note: note })
      setShowFeedback(false); setFeedbackText('')
      startTransition(async () => {
        const result = await markDirectTaskFailed(task.id, note)
        if (result.error) rollback(prevStatus, prevNote)
      })
      return
    }

    // 'done' и 'comment' идут через submitDirectTaskFeedback.
    const newStatus = feedbackTarget === 'comment' ? optimisticStatus : 'done'
    setOptimisticNote(note)
    setOptimisticStatus(newStatus)
    onUpdated({ status: newStatus, employee_note: note })
    setShowFeedback(false); setFeedbackText('')
    startTransition(async () => {
      const result = await submitDirectTaskFeedback(task.id, note, newStatus)
      if (result.error) rollback(prevStatus, prevNote)
    })
  }

  return (
    <div className="rounded-2xl flex flex-col transition-all"
      style={{ background: 'rgba(245,158,11,0.04)', border: `1px solid ${borderColor}` }}>
      <div className="p-4 flex flex-col gap-3">
        {/* Шапка */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
            <Send size={10} />
            Поручение
          </div>
          {task.creator && (
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
              <User size={10} />
              {formatNameShort(task.creator.full_name)}
            </span>
          )}
          <span className="ml-auto text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1"
            style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
            {optimisticStatus === 'done' && <Check size={11} />}
            {optimisticStatus === 'failed' && <AlertCircle size={11} />}
            {sc.label}
          </span>
        </div>

        {/* Заголовок + описание */}
        <div>
          <p className="text-base font-semibold leading-snug" style={{ color: 'var(--text)' }}>{task.title}</p>
          {task.description && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{task.description}</p>
          )}
        </div>

        {/* Приоритет + дедлайн */}
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: pc.bg, color: pc.color }}>
            {pc.label}
          </span>
          {task.deadline && (
            <span className="flex items-center gap-1 text-xs ml-auto"
              style={{ color: isOverdue ? '#f87171' : 'var(--text-dim)' }}>
              {isOverdue ? <AlertTriangle size={11} /> : <Calendar size={11} />}
              {new Date(task.deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Ответ / причина */}
        {optimisticNote && (
          <div className="flex gap-2 p-3 rounded-xl"
            style={{
              background: optimisticStatus === 'failed' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${optimisticStatus === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
            }}>
            <MessageSquare size={13} style={{
              color: optimisticStatus === 'failed' ? 'var(--color-danger)' : '#f59e0b',
              flexShrink: 0, marginTop: '1px',
            }} />
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{
                color: optimisticStatus === 'failed' ? 'var(--color-danger)' : '#f59e0b',
              }}>
                {optimisticStatus === 'failed' ? 'Причина' : 'Ваш ответ'}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{optimisticNote}</p>
            </div>
          </div>
        )}
      </div>

      {/* Кнопки действий */}
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap"
        style={{
          borderTop: `1px solid ${optimisticStatus === 'done' ? 'rgba(34,197,94,0.2)' : borderColor}`,
          background: optimisticStatus === 'done' ? 'rgba(34,197,94,0.05)'
                    : optimisticStatus === 'failed' ? 'rgba(239,68,68,0.04)'
                    : 'rgba(0,0,0,0.1)',
        }}>
        {/* Не принято → Принять / Отклонить */}
        {optimisticStatus === 'todo' && (
          <>
            <button onClick={handleAccept} disabled={pending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'var(--color-green)', color: '#040d07' }}>
              <Check size={13} />
              Принять
            </button>
            <button onClick={() => openFeedback('reject')} disabled={pending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <X size={13} />
              Отклонить
            </button>
          </>
        )}

        {/* В работе / На проверке → Завершить / Не завершено */}
        {(optimisticStatus === 'in_progress' || optimisticStatus === 'review') && (
          <>
            <button onClick={() => openFeedback('done')} disabled={pending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'var(--color-green)', color: '#040d07' }}>
              <Check size={13} />
              Завершить
            </button>
            <button onClick={() => openFeedback('fail')} disabled={pending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: 'var(--color-danger)',
                border: '1px solid rgba(239,68,68,0.3)',
              }}>
              <AlertCircle size={13} />
              Не завершено
            </button>
          </>
        )}

        {/* Завершено */}
        {optimisticStatus === 'done' && (
          <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--green)' }}>
            <Check size={14} />
            Задание выполнено
          </span>
        )}

        {/* Не завершено */}
        {optimisticStatus === 'failed' && (
          <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-danger)' }}>
            <RotateCcw size={14} />
            Ожидает решения руководителя
          </span>
        )}

        {/* Комментарий — доступен в любом статусе (на проверке / done / failed) */}
        {isPostActionMode && (
          <button onClick={() => openFeedback('comment')} disabled={pending}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: showFeedback ? 'rgba(245,158,11,0.15)' : 'var(--surface-2)',
              color: showFeedback ? '#f59e0b' : 'var(--text-muted)',
              border: `1px solid ${showFeedback ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
            }}>
            <MessageSquare size={13} />
            Комментарий
          </button>
        )}

        {pending && <Loader2 size={14} className="animate-spin ml-auto" style={{ color: 'var(--text-dim)' }} />}
      </div>

      {/* Форма обратной связи / причины */}
      {showFeedback && (
        <div className="px-4 pb-4" style={{ borderTop: `1px solid ${borderColor}` }}>
          <p className="text-xs font-semibold mt-3 mb-2 flex items-center gap-1.5" style={{
            color: feedbackTarget === 'reject' || feedbackTarget === 'fail' ? 'var(--color-danger)' : '#f59e0b',
          }}>
            <MessageSquare size={11} />
            {feedbackFormTitle}
          </p>
          <textarea autoFocus value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
            placeholder={feedbackPlaceholder}
            rows={3}
            className="w-full text-sm outline-none resize-none rounded-xl p-3"
            style={{
              background: 'var(--surface-2)',
              border: `1px solid ${feedbackTarget === 'reject' || feedbackTarget === 'fail' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'}`,
              color: 'var(--text)', lineHeight: 1.5, fontFamily: 'inherit',
            }}
            onKeyDown={e => { if (e.key === 'Escape') setShowFeedback(false) }}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleFeedbackSubmit} disabled={!feedbackText.trim() || pending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={
                feedbackTarget === 'reject' || feedbackTarget === 'fail'
                  ? { background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.35)' }
                  : { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }
              }>
              <Send size={13} />
              Отправить
            </button>
            <button onClick={() => setShowFeedback(false)}
              className="px-4 py-2 rounded-xl text-sm"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
