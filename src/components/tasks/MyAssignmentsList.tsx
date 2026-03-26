'use client'

import { useState, useTransition } from 'react'
import {
  Send, User, AlertTriangle, Calendar, MessageSquare,
  PlayCircle, ThumbsUp, ThumbsDown, Check, Loader2, Search, X,
} from 'lucide-react'
import { updateTaskStatus, submitTaskFeedback } from '@/lib/actions/tasks'

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
  todo:        { color: 'var(--text-muted)', bg: 'var(--surface-2)',       border: 'var(--border-2)',         label: 'К выполнению'    },
  in_progress: { color: '#60a5fa',           bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.3)',    label: 'В работе'        },
  review:      { color: '#f59e0b',           bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.3)',    label: 'На проверке'     },
  done:        { color: 'var(--green)',       bg: 'var(--green-glow)',      border: 'rgba(34,197,94,0.3)',     label: 'Выполнено'       },
}

const STATUS_TABS = [
  { key: 'active', label: 'Активные'       },
  { key: 'review', label: 'На проверке'    },
  { key: 'done',   label: 'Выполненные'    },
  { key: 'all',    label: 'Все'            },
]

export default function MyAssignmentsList({ initialTasks }: { initialTasks: Assignment[] }) {
  const [tasks, setTasks]       = useState(initialTasks)
  const [tab, setTab]           = useState('active')
  const [search, setSearch]     = useState('')

  const filtered = tasks.filter(t => {
    if (tab === 'active' && (t.status === 'done' || t.status === 'review')) return false
    if (tab === 'review' && t.status !== 'review') return false
    if (tab === 'done'   && t.status !== 'done')   return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts: Record<string, number> = { all: tasks.length, done: 0, review: 0, active: 0 }
  for (const t of tasks) {
    if (t.status === 'done')   counts.done++
    else if (t.status === 'review') counts.review++
    else counts.active++
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

  return (
    <div className="space-y-4">
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
                {t.key !== 'review' && (
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
    </div>
  )
}

// ─── Карточка поручения ───────────────────────────────────────────────────────
function AssignmentCard({ task, onUpdated }: {
  task: Assignment
  onUpdated: (patch: Partial<Assignment>) => void
}) {
  const today     = new Date()
  const isOverdue = task.deadline && new Date(task.deadline) < today && task.status !== 'done'

  const [optimisticStatus, setOptimisticStatus] = useState(task.status)
  const [optimisticNote,   setOptimisticNote]   = useState(task.employee_note ?? '')
  const [showFeedback,     setShowFeedback]     = useState(false)
  const [feedbackText,     setFeedbackText]     = useState('')
  const [pending, startTransition]              = useTransition()

  const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
  const sc = STATUS_CONFIG[optimisticStatus]  ?? STATUS_CONFIG.todo

  const borderColor = optimisticStatus === 'done'
    ? 'rgba(34,197,94,0.3)'
    : optimisticStatus === 'review'
    ? 'rgba(245,158,11,0.35)'
    : isOverdue
    ? 'rgba(239,68,68,0.3)'
    : 'rgba(245,158,11,0.2)'

  function handleStatus(newStatus: string) {
    setOptimisticStatus(newStatus)
    onUpdated({ status: newStatus })
    startTransition(async () => {
      const result = await updateTaskStatus(task.id, newStatus)
      if (result.error) { setOptimisticStatus(task.status); onUpdated({ status: task.status }) }
    })
  }

  function handleFeedbackSubmit() {
    if (!feedbackText.trim()) return
    const note = feedbackText.trim()
    setOptimisticNote(note)
    setOptimisticStatus('review')
    onUpdated({ status: 'review', employee_note: note })
    setShowFeedback(false)
    setFeedbackText('')
    startTransition(async () => {
      const result = await submitTaskFeedback(task.id, note, 'review')
      if (result.error) {
        setOptimisticNote(task.employee_note ?? '')
        setOptimisticStatus(task.status)
        onUpdated({ status: task.status, employee_note: task.employee_note })
      }
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
              {task.creator.full_name.split(' ').slice(0, 2).join(' ')}
            </span>
          )}
          <span className="ml-auto text-xs px-2.5 py-1 rounded-lg font-semibold"
            style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
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
              {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Ответ */}
        {optimisticNote && (
          <div className="flex gap-2 p-3 rounded-xl"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <MessageSquare size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: '#f59e0b' }}>Ваш ответ</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{optimisticNote}</p>
            </div>
          </div>
        )}
      </div>

      {/* Кнопки действий */}
      {optimisticStatus !== 'done' && (
        <div className="flex items-center gap-2 px-4 py-3 flex-wrap"
          style={{ borderTop: `1px solid ${borderColor}`, background: 'rgba(0,0,0,0.1)' }}>
          {optimisticStatus === 'todo' && (
            <button onClick={() => handleStatus('in_progress')} disabled={pending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
              <PlayCircle size={13} />
              Принять к работе
            </button>
          )}
          {(optimisticStatus === 'in_progress' || optimisticStatus === 'review') && (
            <button onClick={() => handleStatus('done')} disabled={pending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <ThumbsUp size={13} />
              Выполнено
            </button>
          )}
          {optimisticStatus !== 'review' && (
            <button onClick={() => setShowFeedback(v => !v)} disabled={pending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: showFeedback ? 'rgba(245,158,11,0.15)' : 'var(--surface-2)',
                color: showFeedback ? '#f59e0b' : 'var(--text-muted)',
                border: `1px solid ${showFeedback ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
              }}>
              <ThumbsDown size={13} />
              Есть проблема
            </button>
          )}
          {pending && <Loader2 size={14} className="animate-spin ml-auto" style={{ color: 'var(--text-dim)' }} />}
        </div>
      )}

      {optimisticStatus === 'done' && (
        <div className="flex items-center gap-2 px-4 py-3"
          style={{ borderTop: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.05)' }}>
          <Check size={14} style={{ color: 'var(--green)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--green)' }}>Задание выполнено</span>
        </div>
      )}

      {/* Форма обратной связи */}
      {showFeedback && (
        <div className="px-4 pb-4" style={{ borderTop: `1px solid ${borderColor}` }}>
          <p className="text-xs font-semibold mt-3 mb-2 flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
            <MessageSquare size={11} />
            Опишите проблему или причину
          </p>
          <textarea autoFocus value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
            placeholder="Напишите что случилось или почему не можете выполнить..."
            rows={3}
            className="w-full text-sm outline-none resize-none rounded-xl p-3"
            style={{ background: 'var(--surface-2)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--text)', lineHeight: 1.5, fontFamily: 'inherit' }}
            onKeyDown={e => { if (e.key === 'Escape') setShowFeedback(false) }}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleFeedbackSubmit} disabled={!feedbackText.trim() || pending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }}>
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
