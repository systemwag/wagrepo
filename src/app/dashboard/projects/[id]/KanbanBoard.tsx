'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { deleteTask } from '@/lib/actions/projects'
import {
  ClipboardList, CheckSquare, Link2, User, Check as CheckIcon,
  AlertCircle, Calendar, AlertTriangle, Plus, X, Layers,
  FileSearch, Pencil, Clipboard, MessageSquare, ShieldCheck, Package,
} from 'lucide-react'

type Employee = { id: string; full_name: string }
type ChecklistItemRef = { id: string; label: string; is_completed: boolean }
type Stage = {
  id: string
  name: string
  order_index: number
  assignee: { id: string; full_name: string } | null
  checklist_items: ChecklistItemRef[]
}
type Task = {
  id: string
  title: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  stage_id: string | null
  deadline: string | null
  assignee: { full_name: string } | null
  checklist_item_id: string | null
  checklist_item: { id: string; label: string } | null
}

type Props = {
  stages: Stage[]
  tasks: Task[]
  projectId: string
  canManage: boolean
  employees: Employee[]
  userRole?: string
}

const STAGE_COLORS = [
  { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  glow: 'rgba(59,130,246,0.05)'  },
  { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  glow: 'rgba(16,185,129,0.05)'  },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  glow: 'rgba(245,158,11,0.05)'  },
  { color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  glow: 'rgba(168,85,247,0.05)'  },
  { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   glow: 'rgba(6,182,212,0.05)'   },
  { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  glow: 'rgba(249,115,22,0.05)'  },
  { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   glow: 'rgba(244,63,94,0.05)'   },
  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   glow: 'rgba(34,197,94,0.05)'   },
]

const STAGE_ICONS = [Layers, FileSearch, Pencil, Clipboard, MessageSquare, ShieldCheck, Package, CheckSquare]

const priorityStyle: Record<string, React.CSSProperties> = {
  low:      { background: 'var(--surface-2)',       color: 'var(--text-muted)' },
  medium:   { background: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
  high:     { background: 'rgba(249,115,22,0.12)',  color: '#fb923c' },
  critical: { background: 'rgba(239,68,68,0.12)',   color: '#f87171' },
}
const priorityLabel: Record<string, string> = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критичный',
}
const PRIORITY_CONFIG = [
  { value: 'low',      label: 'Низкий',    color: 'var(--text-muted)', bg: 'var(--surface-2)',       border: 'var(--border-2)' },
  { value: 'medium',   label: 'Средний',   color: '#60a5fa',           bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)' },
  { value: 'high',     label: 'Высокий',   color: '#fb923c',           bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
  { value: 'critical', label: 'Критичный', color: '#f87171',           bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
]

export default function KanbanBoard({ stages, tasks, projectId, canManage, employees, userRole }: Props) {
  const router = useRouter()
  const isDirector = userRole === 'director'
  const [localTasks, setLocalTasks] = useState(tasks)
  const [showNewTask, setShowNewTask] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskLinkedItem, setNewTaskLinkedItem] = useState<string>('')
  const [newTaskPriority, setNewTaskPriority] = useState<string>('medium')
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function createTask(stageId: string) {
    if (!newTaskTitle.trim()) return
    setCreating(true)
    setCreateError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setCreateError('Не авторизован')
      setCreating(false)
      return
    }

    const { error } = await supabase.from('tasks').insert({
      project_id: projectId,
      stage_id: stageId,
      title: newTaskTitle.trim(),
      created_by: user.id,
      priority: newTaskPriority,
      ...(newTaskAssigneeId ? { assignee_id: newTaskAssigneeId } : {}),
      ...(newTaskLinkedItem ? { checklist_item_id: newTaskLinkedItem } : {}),
    })

    if (error) {
      setCreateError(error.message)
      setCreating(false)
      return
    }

    setNewTaskTitle('')
    setNewTaskLinkedItem('')
    setNewTaskPriority('medium')
    setNewTaskAssigneeId('')
    setShowNewTask(null)
    setCreating(false)
    setCreateError(null)
    router.refresh()
  }

  function openNewTask(stageId: string) {
    setShowNewTask(stageId)
    setNewTaskTitle('')
    setNewTaskLinkedItem('')
    setNewTaskPriority('medium')
    setNewTaskAssigneeId('')
  }

  async function moveTask(taskId: string, stageId: string) {
    const supabase = createClient()
    await supabase.from('tasks').update({ stage_id: stageId }).eq('id', taskId)
    router.refresh()
  }

  function removeTask(taskId: string) {
    setLocalTasks(prev => prev.filter(t => t.id !== taskId))
  }

  async function assignStage(stageId: string, employeeId: string | null) {
    const supabase = createClient()
    await supabase.from('project_stages').update({ assignee_id: employeeId }).eq('id', stageId)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {stages.map((stage, idx) => {
        const sc = STAGE_COLORS[idx % STAGE_COLORS.length]
        const StageIcon = STAGE_ICONS[idx % STAGE_ICONS.length]
        const stageTasks = localTasks.filter(t => t.stage_id === stage.id)
        const checklistItems = stage.checklist_items ?? []
        const doneItems = checklistItems.filter(i => i.is_completed).length
        const checklistPct = checklistItems.length ? Math.round((doneItems / checklistItems.length) * 100) : 0
        const num = String(idx + 1).padStart(2, '0')

        return (
          <div
            key={stage.id}
            className="rounded-2xl overflow-hidden"
            style={{
              background: sc.glow,
              border: `1px solid ${sc.color}33`,
            }}
          >
            {/* ── Заголовок этапа ── */}
            <div className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: `1px solid ${sc.color}22` }}>
              {/* Иконка этапа */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: sc.bg, color: sc.color, border: `2px solid ${sc.color}44` }}
              >
                <StageIcon size={24} />
              </div>

              {/* Название + прогресс */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <span className="text-xs font-mono font-bold" style={{ color: sc.color + 'aa' }}>{num}</span>
                  <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{stage.name}</h3>
                  <span
                    className="text-sm px-2.5 py-0.5 rounded-full font-semibold"
                    style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}33` }}
                  >
                    {stageTasks.length} задач
                  </span>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  {/* Прогресс чеклиста */}
                  {checklistItems.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-28 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-2)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${checklistPct}%`, background: checklistPct === 100 ? 'var(--green)' : sc.color }}
                        />
                      </div>
                      <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <CheckSquare size={13} style={{ color: sc.color }} />
                        {doneItems}/{checklistItems.length}
                      </span>
                    </div>
                  )}

                  {/* Ответственный */}
                  <StageAssignee
                    stage={stage}
                    employees={employees}
                    canManage={canManage}
                    stageColor={sc.color}
                    onAssign={assignStage}
                  />
                </div>
              </div>

              {/* Кнопка добавить задачу */}
              {canManage && showNewTask !== stage.id && (
                <button
                  onClick={() => openNewTask(stage.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm flex-shrink-0 transition-all"
                  style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}44` }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = sc.color
                    ;(e.currentTarget as HTMLElement).style.color = '#fff'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = sc.bg
                    ;(e.currentTarget as HTMLElement).style.color = sc.color
                  }}
                >
                  <Plus size={16} />
                  Добавить
                </button>
              )}
            </div>

            {/* ── Задачи ── */}
            <div className="px-5 py-4">
              {stageTasks.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-3">
                  {stageTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      stages={stages}
                      canManage={canManage}
                      isDirector={isDirector}
                      projectId={projectId}
                      accentColor={sc.color}
                      onMove={moveTask}
                      onDeleted={() => removeTask(task.id)}
                    />
                  ))}
                </div>
              )}

              {/* Форма создания */}
              {showNewTask === stage.id && (
                <div
                  className="rounded-2xl p-5 space-y-4 mb-3"
                  style={{ background: 'var(--surface)', border: `1px solid ${sc.color}44`, boxShadow: `0 4px 24px ${sc.color}15` }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: sc.color }} />
                    <span className="text-sm font-semibold" style={{ color: sc.color }}>Новая задача — {stage.name}</span>
                    <button onClick={() => setShowNewTask(null)} className="ml-auto" style={{ color: 'var(--text-dim)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Название */}
                  <textarea
                    autoFocus
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    placeholder="Название задачи..."
                    rows={2}
                    className="w-full bg-transparent text-base outline-none resize-none font-medium"
                    style={{ color: 'var(--text)' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createTask(stage.id) }
                      if (e.key === 'Escape') setShowNewTask(null)
                    }}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Приоритет */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertCircle size={13} style={{ color: 'var(--text-dim)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>Приоритет</span>
                      </div>
                      <div className="flex gap-2">
                        {PRIORITY_CONFIG.map(p => {
                          const active = newTaskPriority === p.value
                          return (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => setNewTaskPriority(p.value)}
                              className="flex-1 text-sm py-2 rounded-xl font-medium transition-all"
                              style={{
                                background: active ? p.bg : 'transparent',
                                color: active ? p.color : 'var(--text-dim)',
                                border: `1px solid ${active ? p.border : 'var(--border)'}`,
                              }}
                            >
                              {p.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Ответственный */}
                    {employees.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <User size={13} style={{ color: 'var(--text-dim)' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>Ответственный</span>
                          {newTaskAssigneeId && (
                            <button onClick={() => setNewTaskAssigneeId('')} className="ml-auto text-xs" style={{ color: '#f87171' }}>
                              сбросить
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {employees.map(emp => {
                            const selected = newTaskAssigneeId === emp.id
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => setNewTaskAssigneeId(selected ? '' : emp.id)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm"
                                style={{
                                  background: selected ? 'var(--green-glow)' : 'var(--surface-2)',
                                  border: `1px solid ${selected ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                                  color: selected ? 'var(--green)' : 'var(--text)',
                                }}
                              >
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                                  style={{
                                    background: selected ? 'rgba(34,197,94,0.25)' : 'var(--border-2)',
                                    color: selected ? 'var(--green)' : 'var(--text-muted)',
                                  }}
                                >
                                  {emp.full_name.charAt(0)}
                                </div>
                                <span>{emp.full_name.split(' ')[0]}</span>
                                {selected && <CheckIcon size={13} />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Связать с пунктом чеклиста */}
                  {checklistItems.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Link2 size={13} style={{ color: 'var(--text-dim)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>Связать с пунктом</span>
                        {newTaskLinkedItem && (
                          <button onClick={() => setNewTaskLinkedItem('')} className="ml-auto text-xs" style={{ color: '#f87171' }}>
                            сбросить
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {checklistItems.map(item => {
                          const linked = newTaskLinkedItem === item.id
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setNewTaskLinkedItem(linked ? '' : item.id)}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all text-sm"
                              style={{
                                background: linked ? 'var(--green-glow)' : 'var(--surface-2)',
                                border: `1px solid ${linked ? 'rgba(34,197,94,0.35)' : 'var(--border)'}`,
                                color: linked ? 'var(--green)' : item.is_completed ? 'var(--text-dim)' : 'var(--text)',
                                textDecoration: item.is_completed ? 'line-through' : 'none',
                              }}
                            >
                              <ClipboardList size={12} style={{ flexShrink: 0 }} />
                              <span>{item.label}</span>
                              {item.is_completed && <span style={{ color: 'var(--green)' }}>✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {createError && (
                    <p className="text-sm px-3 py-2 rounded-xl" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)' }}>
                      {createError}
                    </p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => createTask(stage.id)}
                      disabled={creating || !newTaskTitle.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 transition-all"
                      style={{ background: sc.color, color: '#fff' }}
                      onMouseEnter={e => { if (!creating && newTaskTitle.trim()) (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                    >
                      <Plus size={16} />
                      {creating ? 'Создание...' : 'Создать задачу'}
                    </button>
                    <button
                      onClick={() => setShowNewTask(null)}
                      className="text-sm px-4 py-2.5 rounded-xl transition-colors"
                      style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {/* Пустой этап */}
              {stageTasks.length === 0 && showNewTask !== stage.id && (
                <div
                  className="rounded-xl py-8 flex flex-col items-center gap-2"
                  style={{ border: `2px dashed ${sc.color}33` }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: sc.bg, color: sc.color }}>
                    <StageIcon size={18} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>Нет задач</p>
                  {canManage && (
                    <button
                      onClick={() => openNewTask(stage.id)}
                      className="text-sm px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: sc.color }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = sc.bg}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      + Добавить задачу
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StageAssignee({ stage, employees, canManage, stageColor, onAssign }: {
  stage: Stage
  employees: Employee[]
  canManage: boolean
  stageColor: string
  onAssign: (stageId: string, employeeId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const assignee = stage.assignee
  if (!canManage && !assignee) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => canManage && setOpen(o => !o)}
        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-colors text-sm"
        style={{ cursor: canManage ? 'pointer' : 'default' }}
        onMouseEnter={e => { if (canManage) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
        onMouseLeave={e => { if (canManage) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {assignee ? (
          <>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ background: stageColor + '22', color: stageColor, border: `1.5px solid ${stageColor}44` }}
            >
              {assignee.full_name.charAt(0).toUpperCase()}
            </div>
            <span style={{ color: 'var(--text-muted)' }}>{assignee.full_name.split(' ')[0]}</span>
          </>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>
            <User size={14} className="inline mr-1" />+ Ответственный
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-60 rounded-xl z-20 overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        >
          {assignee && (
            <button
              onClick={() => { onAssign(stage.id, null); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors"
              style={{ color: '#f87171' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <X size={14} />
              Снять ответственного
            </button>
          )}
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => { onAssign(stage.id, emp.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
              style={{ background: emp.id === assignee?.id ? 'var(--green-glow)' : 'transparent' }}
              onMouseEnter={e => { if (emp.id !== assignee?.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { if (emp.id !== assignee?.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                style={{
                  background: emp.id === assignee?.id ? 'var(--green-glow)' : 'var(--surface-2)',
                  color: emp.id === assignee?.id ? 'var(--green)' : 'var(--text-muted)',
                  border: emp.id === assignee?.id ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                }}
              >
                {emp.full_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm truncate" style={{ color: emp.id === assignee?.id ? 'var(--green)' : 'var(--text)' }}>
                {emp.full_name}
              </span>
              {emp.id === assignee?.id && <CheckIcon size={13} className="ml-auto flex-shrink-0" style={{ color: 'var(--green)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TaskCard({ task, stages: _stages, canManage: _canManage, isDirector, projectId, accentColor, onMove: _onMove, onDeleted }: {
  task: Task
  stages: Stage[]
  canManage: boolean
  isDirector: boolean
  projectId: string
  accentColor: string
  onMove: (taskId: string, stageId: string) => void
  onDeleted: () => void
}) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [, startDeleteTransition] = useTransition()

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteTask(task.id, projectId)
      if (!result?.error) onDeleted()
    })
  }

  return (
    <div
      className="rounded-xl p-4 transition-all group flex flex-col gap-3"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = accentColor + '44'
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${accentColor}15`
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'
        setDeleteConfirm(false)
      }}
    >
      {/* Заголовок */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-base leading-snug font-medium flex-1" style={{ color: 'var(--text)' }}>{task.title}</p>
        {isDirector && !deleteConfirm && (
          <button
            onClick={e => { e.stopPropagation(); setDeleteConfirm(true) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 p-1 rounded-lg"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.color = '#f87171'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
            title="Удалить задачу"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {deleteConfirm && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span className="text-sm flex-1" style={{ color: '#f87171' }}>Удалить задачу?</span>
          <button onClick={handleDelete} className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>Да</button>
          <button onClick={() => setDeleteConfirm(false)} className="text-xs px-2.5 py-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>Нет</button>
        </div>
      )}

      {/* Приоритет + дедлайн */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm px-2.5 py-1 rounded-lg font-medium" style={priorityStyle[task.priority]}>
          {priorityLabel[task.priority]}
        </span>
        {task.deadline && (
          <span className="flex items-center gap-1 text-sm" style={{ color: isOverdue ? '#f87171' : 'var(--text-muted)' }}>
            {isOverdue ? <AlertTriangle size={13} /> : <Calendar size={13} />}
            {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {/* Связанный пункт */}
      {task.checklist_item && (
        <div
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <Link2 size={12} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <span className="text-sm truncate" style={{ color: 'var(--text-dim)' }}>{task.checklist_item.label}</span>
        </div>
      )}

      {/* Ответственный */}
      {task.assignee && (
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: accentColor + '22', border: `1px solid ${accentColor}33` }}
          >
            <span className="text-xs font-semibold" style={{ color: accentColor }}>{task.assignee.full_name.charAt(0)}</span>
          </div>
          <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{task.assignee.full_name}</span>
        </div>
      )}
    </div>
  )
}
