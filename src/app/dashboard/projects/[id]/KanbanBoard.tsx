'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Employee = { id: string; full_name: string }
type Stage = {
  id: string
  name: string
  order_index: number
  assignee: { id: string; full_name: string } | null
}
type Task = {
  id: string
  title: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  stage_id: string | null
  deadline: string | null
  assignee: { full_name: string } | null
}

type Props = {
  stages: Stage[]
  tasks: Task[]
  projectId: string
  canManage: boolean
  employees: Employee[]
}

const priorityStyle: Record<string, React.CSSProperties> = {
  low: { background: 'var(--surface-2)', color: 'var(--text-muted)' },
  medium: { background: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
  high: { background: 'rgba(249,115,22,0.12)', color: '#fb923c' },
  critical: { background: 'rgba(239,68,68,0.12)', color: '#f87171' },
}

const priorityLabel: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
}

export default function KanbanBoard({ stages, tasks, projectId, canManage, employees }: Props) {
  const router = useRouter()
  const [showNewTask, setShowNewTask] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [creating, setCreating] = useState(false)

  async function createTask(stageId: string) {
    if (!newTaskTitle.trim()) return
    setCreating(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('tasks').insert({
      project_id: projectId,
      stage_id: stageId,
      title: newTaskTitle.trim(),
      created_by: user!.id,
    })

    setNewTaskTitle('')
    setShowNewTask(null)
    setCreating(false)
    router.refresh()
  }

  async function moveTask(taskId: string, stageId: string) {
    const supabase = createClient()
    await supabase.from('tasks').update({ stage_id: stageId }).eq('id', taskId)
    router.refresh()
  }

  async function assignStage(stageId: string, employeeId: string | null) {
    const supabase = createClient()
    await supabase.from('project_stages').update({ assignee_id: employeeId }).eq('id', stageId)
    router.refresh()
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
      {stages.map(stage => {
        const stageTasks = tasks.filter(t => t.stage_id === stage.id)
        return (
          <div key={stage.id} className="flex-shrink-0 w-72">
            {/* Заголовок колонки */}
            <div className="mb-3 px-1">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm" style={{ color: 'var(--text)' }}>{stage.name}</h3>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    {stageTasks.length}
                  </span>
                </div>
                {canManage && (
                  <button
                    onClick={() => { setShowNewTask(stage.id); setNewTaskTitle('') }}
                    className="transition-colors"
                    style={{ color: 'var(--text-dim)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--green)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Ответственный за этап */}
              <StageAssignee
                stage={stage}
                employees={employees}
                canManage={canManage}
                onAssign={assignStage}
              />
            </div>

            {/* Карточки задач */}
            <div className="space-y-2">
              {stageTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  stages={stages}
                  canManage={canManage}
                  onMove={moveTask}
                />
              ))}

              {/* Форма быстрого создания задачи */}
              {showNewTask === stage.id && (
                <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
                  <textarea
                    autoFocus
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    placeholder="Название задачи..."
                    rows={2}
                    className="w-full bg-transparent text-sm outline-none resize-none"
                    style={{ color: 'var(--text)' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createTask(stage.id) }
                      if (e.key === 'Escape') setShowNewTask(null)
                    }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => createTask(stage.id)}
                      disabled={creating || !newTaskTitle.trim()}
                      className="btn-green disabled:opacity-40"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      {creating ? '...' : 'Добавить'}
                    </button>
                    <button
                      onClick={() => setShowNewTask(null)}
                      className="text-xs px-2 py-1.5 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {/* Пустая колонка */}
              {stageTasks.length === 0 && showNewTask !== stage.id && (
                <div className="rounded-xl py-8 text-center" style={{ border: '2px dashed var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Нет задач</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StageAssignee({ stage, employees, canManage, onAssign }: {
  stage: Stage
  employees: Employee[]
  canManage: boolean
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
        className="flex items-center gap-1.5 w-full rounded-lg px-1.5 py-1 transition-colors"
        style={{ cursor: canManage ? 'pointer' : 'default' }}
        onMouseEnter={e => { if (canManage) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
        onMouseLeave={e => { if (canManage) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {assignee ? (
          <>
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
              style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)' }}>
              {assignee.full_name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{assignee.full_name}</span>
            {canManage && (
              <svg className="w-3 h-3 ml-auto flex-shrink-0" style={{ color: 'var(--text-dim)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            + Ответственный
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 rounded-xl z-20 overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          {assignee && (
            <button
              onClick={() => { onAssign(stage.id, null); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
              style={{ color: '#f87171' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Снять ответственного
            </button>
          )}
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => { onAssign(stage.id, emp.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
              style={{ background: emp.id === assignee?.id ? 'var(--green-glow)' : 'transparent' }}
              onMouseEnter={e => { if (emp.id !== assignee?.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { if (emp.id !== assignee?.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
                style={{
                  background: emp.id === assignee?.id ? 'var(--green-glow)' : 'var(--surface-2)',
                  color: emp.id === assignee?.id ? 'var(--green)' : 'var(--text-muted)',
                  border: emp.id === assignee?.id ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                }}>
                {emp.full_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm truncate" style={{ color: emp.id === assignee?.id ? 'var(--green)' : 'var(--text)' }}>
                {emp.full_name}
              </span>
              {emp.id === assignee?.id && (
                <svg className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color: 'var(--green)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TaskCard({ task, stages, canManage, onMove }: {
  task: Task
  stages: Stage[]
  canManage: boolean
  onMove: (taskId: string, stageId: string) => void
}) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date()

  return (
    <div className="rounded-xl p-3 transition-colors group" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
    >
      <p className="text-sm leading-snug mb-2" style={{ color: 'var(--text)' }}>{task.title}</p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={priorityStyle[task.priority]}>
          {priorityLabel[task.priority]}
        </span>
        {task.deadline && (
          <span className="text-xs" style={{ color: isOverdue ? '#f87171' : 'var(--text-muted)' }}>
            {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {task.assignee && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--green-glow)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <span className="text-xs" style={{ color: 'var(--green)' }}>{task.assignee.full_name.charAt(0)}</span>
          </div>
          <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{task.assignee.full_name}</span>
        </div>
      )}

      {/* Переместить в другую колонку */}
      {canManage && (
        <div className="mt-2 hidden group-hover:flex gap-1 flex-wrap">
          {stages
            .filter(s => s.id !== task.stage_id)
            .map(s => (
              <button
                key={s.id}
                onClick={() => onMove(task.id, s.id)}
                className="text-xs px-2 py-0.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--green)'; (e.currentTarget as HTMLElement).style.background = 'var(--green-glow)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              >
                → {s.name}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
