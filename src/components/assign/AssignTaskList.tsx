'use client'

import { useState, useTransition } from 'react'
import {
  Pencil, Trash2, Check, X, AlertTriangle, Calendar,
  MessageSquare, Search,
} from 'lucide-react'
import { updateDirectTask, deleteDirectTask } from '@/lib/actions/tasks'
import DatePicker from '@/components/ui/DatePicker'

type Employee = { id: string; full_name: string; position: string | null }

type AssignedTask = {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  deadline: string | null
  employee_note: string | null
  assignee: { id: string; full_name: string; position: string | null } | null
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  low:      { color: 'var(--text-muted)', bg: 'var(--surface-2)',       border: 'var(--border-2)',          label: 'Низкий'    },
  medium:   { color: '#60a5fa',           bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',     label: 'Средний'   },
  high:     { color: '#fb923c',           bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)',     label: 'Высокий'   },
  critical: { color: '#f87171',           bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',      label: 'Критичный' },
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  todo:        { color: 'var(--text-muted)', bg: 'var(--surface-2)',       border: 'var(--border-2)',          label: 'К выполнению'     },
  in_progress: { color: '#60a5fa',           bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.25)',    label: 'В работе'         },
  review:      { color: '#f59e0b',           bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.3)',     label: 'Требует внимания' },
  done:        { color: 'var(--green)',       bg: 'var(--green-glow)',      border: 'rgba(34,197,94,0.3)',      label: 'Выполнено'        },
}

const STATUS_TABS = [
  { key: 'all',        label: 'Все'              },
  { key: 'todo',       label: 'К выполнению'     },
  { key: 'in_progress',label: 'В работе'         },
  { key: 'review',     label: 'Требует внимания' },
  { key: 'done',       label: 'Выполнено'        },
]

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export default function AssignTaskList({
  initialTasks,
  employees,
}: {
  initialTasks: AssignedTask[]
  employees: Employee[]
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [statusFilter, setStatusFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  function handleDeleted(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    setDeleteId(null)
  }

  function handleUpdated(id: string, updated: Partial<AssignedTask>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t))
    setEditingId(null)
  }

  // Фильтрация
  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (employeeFilter !== 'all' && t.assignee?.id !== employeeFilter) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Счётчики по статусам
  const counts: Record<string, number> = { all: tasks.length }
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1
  const reviewCount = counts['review'] ?? 0

  // Уникальные исполнители для фильтра
  const assignees = Array.from(
    new Map(tasks.filter(t => t.assignee).map(t => [t.assignee!.id, t.assignee!])).values()
  )

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl py-16 text-center" style={{ border: '2px dashed var(--border)' }}>
        <div className="text-4xl mb-3 opacity-20">📋</div>
        <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Поручений пока нет</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Создайте первое задание для сотрудника</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Фильтры ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {/* Статус-табы — горизонтальный скролл на маленьких экранах */}
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto scroll-x-hidden flex-shrink-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {STATUS_TABS.map(tab => {
            const active = statusFilter === tab.key
            const cnt = counts[tab.key] ?? 0
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: active ? 'var(--surface-2)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-dim)',
                  border: active ? '1px solid var(--border-2)' : '1px solid transparent',
                }}
              >
                {tab.label}
                {tab.key === 'review' && reviewCount > 0 && (
                  <span className="w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                    style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                    {reviewCount}
                  </span>
                )}
                {tab.key !== 'review' && cnt > 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{cnt}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Фильтр по сотруднику */}
        {assignees.length > 1 && (
          <select
            value={employeeFilter}
            onChange={e => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', colorScheme: 'dark' }}
          >
            <option value="all">Все сотрудники</option>
            {assignees.map(a => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
        )}

        {/* Поиск */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-40" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="bg-transparent outline-none text-sm flex-1"
            style={{ color: 'var(--text)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--text-dim)' }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Список задач ── */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center rounded-2xl" style={{ border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Нет поручений по этому фильтру</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              employees={employees}
              isEditing={editingId === task.id}
              isDeleting={deleteId === task.id}
              noteExpanded={expandedNote === task.id}
              onEdit={() => { setEditingId(task.id); setDeleteId(null) }}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => setDeleteId(task.id === deleteId ? null : task.id)}
              onCancelDelete={() => setDeleteId(null)}
              onDeleted={() => handleDeleted(task.id)}
              onUpdated={(u) => handleUpdated(task.id, u)}
              onToggleNote={() => setExpandedNote(expandedNote === task.id ? null : task.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Строка задачи ────────────────────────────────────────────────────────────
function TaskRow({
  task, employees, isEditing, isDeleting, noteExpanded,
  onEdit, onCancelEdit, onDelete, onCancelDelete, onDeleted, onUpdated, onToggleNote,
}: {
  task: AssignedTask
  employees: Employee[]
  isEditing: boolean
  isDeleting: boolean
  noteExpanded: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  onCancelDelete: () => void
  onDeleted: () => void
  onUpdated: (u: Partial<AssignedTask>) => void
  onToggleNote: () => void
}) {
  const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
  const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'
  const hasNote = !!task.employee_note

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${
          task.status === 'review' ? 'rgba(245,158,11,0.35)' :
          task.status === 'done'   ? 'rgba(34,197,94,0.2)'   :
          isOverdue                ? 'rgba(239,68,68,0.25)'  :
          'var(--border)'
        }`,
      }}
    >
      {isEditing ? (
        <EditTaskForm task={task} employees={employees} onSaved={onUpdated} onCancel={onCancelEdit} />
      ) : (
        <>
          {/* ── Шапка карточки ── */}
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Строка 1: аватар + имя + кнопки действий */}
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{
                  background: task.status === 'done' ? 'var(--green-glow)' : 'var(--surface-2)',
                  color: task.status === 'done' ? 'var(--green)' : 'var(--text-muted)',
                  border: `1.5px solid ${task.status === 'done' ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                }}
              >
                {task.assignee?.full_name.charAt(0).toUpperCase() ?? '?'}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {task.assignee?.full_name ?? '—'}
                </p>
                {task.assignee?.position && (
                  <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
                    {task.assignee.position}
                  </p>
                )}
              </div>

              {/* Кнопки действий — всегда справа */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {hasNote && (
                  <button onClick={onToggleNote} title="Ответ сотрудника"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: noteExpanded ? 'rgba(245,158,11,0.15)' : 'transparent',
                      color: '#f59e0b',
                      border: `1px solid ${noteExpanded ? 'rgba(245,158,11,0.3)' : 'transparent'}`,
                    }}>
                    <MessageSquare size={14} />
                  </button>
                )}
                <button onClick={onEdit} title="Редактировать"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: 'var(--text-dim)', border: '1px solid transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={onDelete} title="Удалить"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: isDeleting ? '#f87171' : 'var(--text-dim)', border: '1px solid transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = isDeleting ? '#f87171' : 'var(--text-dim)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Строка 2: бейджи приоритет / срок / статус */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                style={{ background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>
                {pc.label}
              </span>

              {task.deadline ? (
                <span className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: isOverdue ? '#f87171' : 'var(--text-muted)' }}>
                  {isOverdue ? <AlertTriangle size={11} /> : <Calendar size={11} />}
                  {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>без срока</span>
              )}

              <span className="text-xs px-2.5 py-1 rounded-xl font-semibold"
                style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                {sc.label}
              </span>
            </div>
          </div>

          {/* ── Основное: текст задания ── */}
          <div className="px-4 py-3.5">
            <p className="text-base font-semibold leading-snug" style={{
              color: 'var(--text)',
              textDecoration: task.status === 'done' ? 'line-through' : 'none',
              opacity: task.status === 'done' ? 0.5 : 1,
            }}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {task.description}
              </p>
            )}
          </div>

          {/* Ответ сотрудника */}
          {hasNote && noteExpanded && (
            <div className="flex gap-3 mx-5 mb-4 p-3.5 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <MessageSquare size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p className="text-xs font-bold mb-1" style={{ color: '#f59e0b' }}>Ответ сотрудника</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{task.employee_note}</p>
              </div>
            </div>
          )}

          {isDeleting && (
            <DeleteConfirm taskId={task.id} onDeleted={onDeleted} onCancel={onCancelDelete} />
          )}
        </>
      )}
    </div>
  )
}

// ─── Инлайн-форма редактирования ─────────────────────────────────────────────
function EditTaskForm({
  task, employees, onSaved, onCancel,
}: {
  task: AssignedTask
  employees: Employee[]
  onSaved: (u: Partial<AssignedTask>) => void
  onCancel: () => void
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
    const result = await updateDirectTask(task.id, { title, description, assignee_id: assigneeId, priority, deadline: deadline || null })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    const newAssignee = employees.find(e => e.id === assigneeId)
    onSaved({
      title, description: description || null,
      assignee: newAssignee ?? task.assignee,
      priority, deadline: deadline || null,
    })
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Pencil size={13} style={{ color: 'var(--text-dim)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Редактировать поручение</span>
        <button onClick={onCancel} className="ml-auto" style={{ color: 'var(--text-dim)' }}><X size={15} /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="col-span-2">
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            rows={2}
            placeholder="Название задачи..."
            className="w-full text-sm font-medium outline-none resize-none rounded-xl p-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
          />
        </div>
        <div className="col-span-2">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Описание..."
            className="w-full text-sm outline-none resize-none rounded-xl p-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
          />
        </div>

        {/* Исполнитель */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>Исполнитель</p>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {employees.map(emp => {
              const sel = assigneeId === emp.id
              return (
                <button key={emp.id} type="button" onClick={() => setAssigneeId(emp.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                  style={{ background: sel ? 'rgba(34,197,94,0.08)' : 'var(--surface-2)', border: `1px solid ${sel ? 'rgba(34,197,94,0.35)' : 'var(--border)'}` }}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: sel ? 'rgba(34,197,94,0.2)' : 'var(--border-2)', color: sel ? 'var(--green)' : 'var(--text-muted)' }}>
                    {emp.full_name.charAt(0)}
                  </div>
                  <span className="text-sm truncate" style={{ color: sel ? 'var(--green)' : 'var(--text)' }}>{emp.full_name}</span>
                  {sel && <Check size={12} style={{ color: 'var(--green)', marginLeft: 'auto', flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Приоритет + Срок */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>Приоритет</p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map(p => {
                const cfg = PRIORITY_CONFIG[p]
                const sel = priority === p
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: sel ? cfg.bg : 'transparent', color: sel ? cfg.color : 'var(--text-dim)', border: `1px solid ${sel ? cfg.border : 'var(--border)'}` }}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>Срок</p>
            <DatePicker value={deadline} onChange={setDeadline} placeholder="Выберите дату" />
          </div>
        </div>
      </div>

      {error && <p className="text-sm px-3 py-2 rounded-xl" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)' }}>{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving} className="btn-green flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
          style={{ padding: '8px 20px' }}>
          <Check size={14} />{saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button onClick={onCancel} className="text-sm px-4 py-2 rounded-xl transition-colors"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          Отмена
        </button>
      </div>
    </div>
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
    <div className="flex items-center gap-3 px-5 py-3" style={{ borderTop: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
      <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
      <span className="text-sm flex-1" style={{ color: '#f87171' }}>Удалить это поручение навсегда?</span>
      <button onClick={handleDelete} disabled={deleting}
        className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
        style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
        {deleting ? '...' : 'Удалить'}
      </button>
      <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm"
        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        Отмена
      </button>
    </div>
  )
}
