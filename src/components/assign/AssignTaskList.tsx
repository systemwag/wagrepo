'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import {
  Pencil, Trash2, Check, X, AlertTriangle, Calendar,
  MessageSquare, Search, Loader2, Clock,
  CheckCircle2, Send, User,
} from 'lucide-react'
import { updateDirectTask, deleteDirectTask } from '@/lib/actions/tasks'
import DatePicker from '@/components/ui/DatePicker'
import { createClient } from '@/lib/supabase/client'

type Employee = { id: string; full_name: string; position: string | null }

export type AssignedTask = {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  deadline: string | null
  employee_note: string | null
  created_at?: string
  assignee: { id: string; full_name: string; position: string | null } | null
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  low:      { color: 'var(--text-muted)', bg: 'var(--surface-2)',      border: 'var(--border-2)',         label: 'Низкий'    },
  medium:   { color: '#60a5fa',          bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)',    label: 'Средний'   },
  high:     { color: '#fb923c',          bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)',    label: 'Высокий'   },
  critical: { color: '#f87171',          bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',     label: 'Критичный' },
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; bar: string }> = {
  todo:        { color: '#a78bfa',           bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)',   label: 'Не принято',  bar: '#a78bfa' },
  in_progress: { color: '#60a5fa',           bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)',   label: 'В работе',    bar: '#3b82f6' },
  review:      { color: '#f59e0b',           bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)',    label: 'На проверке', bar: '#f59e0b' },
  done:        { color: 'var(--green)',       bg: 'var(--green-glow)',    border: 'rgba(34,197,94,0.3)',     label: 'Выполнено',   bar: 'var(--green)' },
}

const STATUS_TABS = [
  { key: 'all',         label: 'Все'          },
  { key: 'todo',        label: 'Не принято'   },
  { key: 'in_progress', label: 'В работе'     },
  { key: 'review',      label: 'На проверке'  },
  { key: 'done',        label: 'Выполнено'    },
]

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  if (diff < 7) return `${diff} дн. назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function AssignTaskList({
  initialTasks,
  employees,
  directorId,
}: {
  initialTasks: AssignedTask[]
  employees: Employee[]
  directorId: string
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [statusFilter, setStatusFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editingTask, setEditingTask] = useState<AssignedTask | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [realtimeActive, setRealtimeActive] = useState(false)
  const supabaseRef = useRef(createClient())

  // Realtime: слушаем изменения задач директора (сотрудники меняют статус/заметки)
  useEffect(() => {
    const supabase = supabaseRef.current

    const channel = supabase
      .channel(`assign-journal-${directorId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `created_by=eq.${directorId}`,
        },
        (payload) => {
          const updated = payload.new as AssignedTask
          setTasks(prev => prev.map(t => {
            if (t.id !== updated.id) return t
            // сохраняем вложенный объект assignee — он не приходит из realtime
            return { ...t, status: updated.status, employee_note: updated.employee_note }
          }))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tasks',
          filter: `created_by=eq.${directorId}`,
        },
        (payload) => {
          setTasks(prev => prev.filter(t => t.id !== (payload.old as { id: string }).id))
        }
      )
      .subscribe((status) => {
        setRealtimeActive(status === 'SUBSCRIBED')
      })

    return () => { supabase.removeChannel(channel) }
  }, [directorId])

  function handleUpdated(id: string, updated: Partial<AssignedTask>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t))
    setEditingTask(null)
  }

  function handleDeleted(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    setDeleteId(null)
  }

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (employeeFilter !== 'all' && t.assignee?.id !== employeeFilter) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts: Record<string, number> = { all: tasks.length }
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1

  const assignees = Array.from(
    new Map(tasks.filter(t => t.assignee).map(t => [t.assignee!.id, t.assignee!])).values()
  )

  const pendingCount = counts.todo ?? 0

  // Статистика
  const stats = [
    { label: 'Не принято',  value: pendingCount,                icon: <Clock size={16} />,         color: '#a78bfa',           bg: 'rgba(167,139,250,0.1)' },
    { label: 'В работе',    value: counts.in_progress ?? 0,     icon: <Loader2 size={16} />,       color: '#60a5fa',           bg: 'rgba(59,130,246,0.1)' },
    { label: 'На проверке', value: counts.review ?? 0,          icon: <MessageSquare size={16} />, color: '#f59e0b',           bg: 'rgba(245,158,11,0.1)' },
    { label: 'Выполнено',   value: counts.done ?? 0,            icon: <CheckCircle2 size={16} />,  color: 'var(--green)',      bg: 'var(--green-glow)' },
  ]

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl py-20 text-center" style={{ border: '2px dashed var(--border)' }}>
        <Send size={32} className="mx-auto mb-3" style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
        <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Поручений пока нет</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Создайте первое задание для сотрудника</p>
      </div>
    )
  }

  return (
    <>
      {/* ── Баннер: непринятые поручения ── */}
      {pendingCount > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5"
          style={{
            background: 'rgba(167,139,250,0.08)',
            border: '1px solid rgba(167,139,250,0.25)',
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}
          >
            <Clock size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>
              {pendingCount} {pendingCount === 1 ? 'поручение ожидает принятия' : pendingCount < 5 ? 'поручения ожидают принятия' : 'поручений ожидают принятия'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
              Сотрудники ещё не взяли задачи в работу
            </p>
          </div>
          <button
            onClick={() => setStatusFilter('todo')}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
            style={{
              background: 'rgba(167,139,250,0.15)',
              color: '#a78bfa',
              border: '1px solid rgba(167,139,250,0.3)',
            }}
          >
            Показать
          </button>
        </div>
      )}

      {/* ── Индикатор realtime ── */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{
            background: realtimeActive ? 'rgba(34,197,94,0.1)' : 'var(--surface-2)',
            color: realtimeActive ? 'var(--green)' : 'var(--text-dim)',
            border: `1px solid ${realtimeActive ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: realtimeActive ? 'var(--green)' : 'var(--text-dim)',
              boxShadow: realtimeActive ? '0 0 6px rgba(34,197,94,0.6)' : 'none',
            }}
          />
          {realtimeActive ? 'Обновления в реальном времени' : 'Подключение...'}
        </span>
      </div>

      {/* ── Статистика ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {stats.map(s => (
          <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: s.bg, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Фильтры ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center mb-4">
        {/* Статус-табы */}
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {STATUS_TABS.map(tab => {
            const active = statusFilter === tab.key
            const cnt = counts[tab.key] ?? 0
            const isReview = tab.key === 'review'
            const reviewCnt = counts.review ?? 0
            return (
              <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  background: active ? 'var(--surface-2)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-dim)',
                  border: active ? '1px solid var(--border-2)' : '1px solid transparent',
                }}>
                {tab.label}
                {isReview && reviewCnt > 0 ? (
                  <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold"
                    style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                    {reviewCnt}
                  </span>
                ) : (
                  cnt > 0 && <span className="text-xs opacity-60">{cnt}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Фильтр по сотруднику */}
        {assignees.length > 1 && (
          <div className="relative">
            <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-dim)' }} />
            <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl text-sm outline-none appearance-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', colorScheme: 'dark' }}>
              <option value="all">Все сотрудники</option>
              {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
        )}

        {/* Поиск */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-40"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="bg-transparent outline-none text-sm flex-1"
            style={{ color: 'var(--text)' }} />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--text-dim)' }}><X size={13} /></button>
          )}
        </div>
      </div>

      {/* ── Список ── */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center rounded-2xl" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Нет поручений по выбранному фильтру</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              isDeleting={deleteId === task.id}
              onEdit={() => setEditingTask(task)}
              onDelete={() => setDeleteId(task.id === deleteId ? null : task.id)}
              onCancelDelete={() => setDeleteId(null)}
              onDeleted={() => handleDeleted(task.id)}
            />
          ))}
        </div>
      )}

      {/* ── Боковая панель редактирования ── */}
      {editingTask && (
        <EditDrawer
          task={editingTask}
          employees={employees}
          onSaved={(u) => handleUpdated(editingTask.id, u)}
          onClose={() => setEditingTask(null)}
        />
      )}
    </>
  )
}

// ─── Карточка задачи ──────────────────────────────────────────────────────────
function TaskCard({
  task, isDeleting, onEdit, onDelete, onCancelDelete, onDeleted,
}: {
  task: AssignedTask
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
  onCancelDelete: () => void
  onDeleted: () => void
}) {
  const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo
  const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
  const now = new Date()
  const isOverdue = task.deadline && new Date(task.deadline) < now && task.status !== 'done'

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${
          task.status === 'review' ? 'rgba(245,158,11,0.35)' :
          task.status === 'done'   ? 'rgba(34,197,94,0.15)'  :
          isOverdue                ? 'rgba(239,68,68,0.25)'  :
          'var(--border)'
        }`,
      }}>

      <div className="flex">
        {/* Цветная полоска статуса */}
        <div className="w-1 flex-shrink-0 rounded-l-2xl" style={{ background: sc.bar }} />

        <div className="flex-1 min-w-0 p-4">
          {/* Верхняя строка: задача + действия */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Название задачи — главный элемент */}
              <p className="font-semibold text-[15px] leading-snug"
                style={{
                  color: 'var(--text)',
                  textDecoration: task.status === 'done' ? 'line-through' : 'none',
                  opacity: task.status === 'done' ? 0.5 : 1,
                }}>
                {task.title}
              </p>
              {task.description && (
                <p className="text-sm mt-1 leading-relaxed line-clamp-2"
                  style={{ color: 'var(--text-muted)' }}>
                  {task.description}
                </p>
              )}
            </div>

            {/* Действия */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={onEdit} title="Редактировать"
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-dim)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)' }}>
                <Pencil size={13} />
              </button>
              <button onClick={onDelete} title="Удалить"
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: isDeleting ? '#f87171' : 'var(--text-dim)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = isDeleting ? '#f87171' : 'var(--text-dim)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Нижняя строка: мета-информация */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3">
            {/* Исполнитель */}
            {task.assignee && (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {task.assignee.full_name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {task.assignee.full_name}
                </span>
              </div>
            )}

            {/* Разделитель */}
            {task.assignee && <span style={{ color: 'var(--border-2)', fontSize: '10px' }}>·</span>}

            {/* Дедлайн */}
            {task.deadline ? (
              <span className="flex items-center gap-1 text-xs font-medium"
                style={{ color: isOverdue ? '#f87171' : 'var(--text-dim)' }}>
                {isOverdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                {formatDeadline(task.deadline)}
              </span>
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-dim)', opacity: 0.6 }}>без срока</span>
            )}

            {/* Разделитель */}
            <span style={{ color: 'var(--border-2)', fontSize: '10px' }}>·</span>

            {/* Приоритет */}
            <span className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>
              {pc.label}
            </span>

            {/* Статус */}
            <span className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
              {sc.label}
            </span>

            {/* Дата создания */}
            {task.created_at && (
              <>
                <span style={{ color: 'var(--border-2)', fontSize: '10px' }}>·</span>
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-dim)', opacity: 0.6 }}>
                  <Clock size={10} />
                  {formatDate(task.created_at)}
                </span>
              </>
            )}
          </div>

          {/* Ответ сотрудника — всегда видимый */}
          {task.employee_note && (
            <div className="mt-3 flex gap-2.5 p-3 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <MessageSquare size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold mb-1" style={{ color: '#f59e0b' }}>
                  Ответ: {task.assignee?.full_name ?? 'сотрудник'}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {task.employee_note}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Подтверждение удаления */}
      {isDeleting && (
        <DeleteConfirm taskId={task.id} onDeleted={onDeleted} onCancel={onCancelDelete} />
      )}
    </div>
  )
}

// ─── Боковая панель редактирования ───────────────────────────────────────────
function EditDrawer({
  task, employees, onSaved, onClose,
}: {
  task: AssignedTask
  employees: Employee[]
  onSaved: (u: Partial<AssignedTask>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? '')
  const [priority, setPriority] = useState(task.priority)
  const [deadline, setDeadline] = useState(task.deadline?.slice(0, 10) ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!title.trim()) { setError('Введите название'); return }
    if (!assigneeId) { setError('Выберите исполнителя'); return }
    setSaving(true)
    setError(null)
    const result = await updateDirectTask(task.id, {
      title, description, assignee_id: assigneeId, priority, deadline: deadline || null,
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    const newAssignee = employees.find(e => e.id === assigneeId)
    onSaved({
      title,
      description: description || null,
      assignee: newAssignee ?? task.assignee,
      priority,
      deadline: deadline || null,
    })
  }

  return (
    <>
      {/* Оверлей */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={onClose} />

      {/* Панель */}
      <div className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-y-auto"
        style={{
          width: 'min(440px, 100vw)',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border-2)',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.4)',
        }}>

        {/* Шапка */}
        <div className="flex items-center justify-between p-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
              <Pencil size={15} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Редактировать поручение</h2>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Изменения сохраняются немедленно</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <X size={16} />
          </button>
        </div>

        {/* Контент */}
        <div className="flex-1 p-5 space-y-5">

          {/* Название */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
              style={{ color: 'var(--text-dim)' }}>Название задачи</label>
            <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2}
              placeholder="Что нужно сделать?"
              className="w-full text-sm font-medium outline-none resize-none rounded-xl p-3"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }} />
          </div>

          {/* Описание */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
              style={{ color: 'var(--text-dim)' }}>Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Дополнительные детали..."
              className="w-full text-sm outline-none resize-none rounded-xl p-3"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }} />
          </div>

          {/* Исполнитель */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
              style={{ color: 'var(--text-dim)' }}>Исполнитель</label>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {employees.map(emp => {
                const sel = assigneeId === emp.id
                return (
                  <button key={emp.id} type="button" onClick={() => setAssigneeId(emp.id)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
                    style={{
                      background: sel ? 'rgba(34,197,94,0.08)' : 'var(--surface-2)',
                      border: `1px solid ${sel ? 'rgba(34,197,94,0.35)' : 'var(--border)'}`,
                    }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: sel ? 'rgba(34,197,94,0.2)' : 'var(--border-2)', color: sel ? 'var(--green)' : 'var(--text-muted)' }}>
                      {emp.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: sel ? 'var(--green)' : 'var(--text)' }}>
                        {emp.full_name}
                      </p>
                      {emp.position && (
                        <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{emp.position}</p>
                      )}
                    </div>
                    {sel && <Check size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Приоритет */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
              style={{ color: 'var(--text-dim)' }}>Приоритет</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PRIORITIES.map(p => {
                const cfg = PRIORITY_CONFIG[p]
                const sel = priority === p
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className="py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: sel ? cfg.bg : 'var(--surface-2)',
                      color: sel ? cfg.color : 'var(--text-dim)',
                      border: `1px solid ${sel ? cfg.border : 'var(--border)'}`,
                    }}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Срок */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
              style={{ color: 'var(--text-dim)' }}>Срок выполнения</label>
            <DatePicker value={deadline} onChange={setDeadline} placeholder="Выберите дату" />
          </div>

          {error && (
            <p className="text-sm px-3 py-2.5 rounded-xl"
              style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Футер */}
        <div className="p-5 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSave} disabled={saving}
            className="btn-green flex-1 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50"
            style={{ padding: '10px 20px' }}>
            <Check size={15} />
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            Отмена
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Подтверждение удаления ───────────────────────────────────────────────────
function DeleteConfirm({ taskId, onDeleted, onCancel }: { taskId: string; onDeleted: () => void; onCancel: () => void }) {
  const [deleting, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteDirectTask(taskId)
      onDeleted()
    })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3"
      style={{ borderTop: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
      <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
      <span className="text-sm flex-1" style={{ color: '#f87171' }}>Удалить это поручение?</span>
      <button onClick={handleDelete} disabled={deleting}
        className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
        {deleting ? '...' : 'Удалить'}
      </button>
      <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm"
        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        Отмена
      </button>
    </div>
  )
}
