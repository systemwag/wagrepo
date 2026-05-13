import { CheckCircle, Clock, Eye, Zap } from 'lucide-react'
import { Badge, BadgeTone } from './Badge'

// ─── Задачи ────────────────────────────────────────────────────────────────
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

const TASK: Record<TaskStatus, { label: string; tone: BadgeTone; icon: React.ReactNode }> = {
  todo:        { label: 'К выполнению', tone: 'neutral', icon: <Clock size={12} /> },
  in_progress: { label: 'В работе',     tone: 'info',    icon: <Zap size={12} /> },
  review:      { label: 'На проверке',  tone: 'warn',    icon: <Eye size={12} /> },
  done:        { label: 'Выполнено',    tone: 'green',   icon: <CheckCircle size={12} /> },
}

export function TaskStatusPill({ status, withIcon = true }: { status: TaskStatus; withIcon?: boolean }) {
  const cfg = TASK[status] ?? TASK.todo
  return <Badge tone={cfg.tone} icon={withIcon ? cfg.icon : undefined}>{cfg.label}</Badge>
}

export const TASK_STATUS_CONFIG = TASK

// ─── Проекты ───────────────────────────────────────────────────────────────
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled'

const PROJECT: Record<ProjectStatus, { label: string; tone: BadgeTone }> = {
  active:    { label: 'Активный',  tone: 'green' },
  on_hold:   { label: 'На паузе',  tone: 'warn' },
  completed: { label: 'Завершён',  tone: 'info' },
  cancelled: { label: 'Отменён',   tone: 'danger' },
}

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  const cfg = PROJECT[status] ?? PROJECT.active
  return <Badge tone={cfg.tone} rounded="pill">{cfg.label}</Badge>
}

// ─── Приоритет задач ───────────────────────────────────────────────────────
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критичный',
}
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low:      'var(--color-text-muted)',
  medium:   'var(--color-info)',
  high:     '#fb923c',
  critical: 'var(--color-danger)',
}

export function PriorityLabel({ priority }: { priority: TaskPriority | string }) {
  const p = (priority as TaskPriority) in PRIORITY_LABEL ? (priority as TaskPriority) : 'medium'
  return (
    <span className="text-xs font-semibold" style={{ color: PRIORITY_COLOR[p] }}>
      {PRIORITY_LABEL[p]}
    </span>
  )
}
