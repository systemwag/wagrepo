import Link from 'next/link'
import {
  AlertCircle, AlertTriangle, Calendar, CheckCircle2, CheckSquare,
  ClipboardList, FolderOpen, Layers, Paperclip,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// Read-only обзор «работы по проектам».
// Никаких действий — только сводка и Link'и на страницу проекта.
// Server-component: state не нужен, всё рендерится из props.
// ─────────────────────────────────────────────────────────────────────────────

export type StageOverview = {
  id: string
  name: string
  order_index: number
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | string
  deadline: string | null
  review_status: 'pending_review' | 'approved' | 'revision_needed' | null
  checklist_done: number
  checklist_total: number
  documents_count: number
  project: { id: string; name: string } | null
}

export type TaskOverview = {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'failed' | string
  priority: 'low' | 'medium' | 'high' | 'critical' | string
  deadline: string | null
  employee_note: string | null
  project: { id: string; name: string } | null
}

const STAGE_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:     { label: 'Ожидание',     color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)',                                  border: 'var(--color-border-2)' },
  in_progress: { label: 'В работе',     color: 'var(--color-info)',       bg: 'color-mix(in oklab, var(--color-info) 12%, transparent)', border: 'color-mix(in oklab, var(--color-info) 30%, transparent)' },
  completed:   { label: 'Завершён',     color: 'var(--color-green)',      bg: 'color-mix(in oklab, var(--color-green) 12%, transparent)',border: 'color-mix(in oklab, var(--color-green) 30%, transparent)' },
  blocked:     { label: 'Заблокирован', color: 'var(--color-danger)',     bg: 'color-mix(in oklab, var(--color-danger) 12%, transparent)',border: 'color-mix(in oklab, var(--color-danger) 30%, transparent)' },
}

const TASK_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  todo:        { label: 'Не принято',  color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)',                                  border: 'var(--color-border-2)' },
  in_progress: { label: 'В работе',    color: 'var(--color-info)',       bg: 'color-mix(in oklab, var(--color-info) 12%, transparent)', border: 'color-mix(in oklab, var(--color-info) 30%, transparent)' },
  review:      { label: 'На проверке', color: 'var(--color-warn)',       bg: 'color-mix(in oklab, var(--color-warn) 12%, transparent)', border: 'color-mix(in oklab, var(--color-warn) 30%, transparent)' },
  done:        { label: 'Завершено',   color: 'var(--color-green)',      bg: 'color-mix(in oklab, var(--color-green) 12%, transparent)',border: 'color-mix(in oklab, var(--color-green) 30%, transparent)' },
  failed:      { label: 'Не завершено',color: 'var(--color-danger)',     bg: 'color-mix(in oklab, var(--color-danger) 12%, transparent)',border: 'color-mix(in oklab, var(--color-danger) 30%, transparent)' },
}

const REVIEW_LABEL: Record<string, string> = {
  pending_review:  'На проверке',
  approved:        'Одобрено',
  revision_needed: 'На доработку',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критичный',
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'var(--color-text-dim)', medium: 'var(--color-info)', high: 'var(--color-warn)', critical: 'var(--color-danger)',
}

const PROJECT_COLORS = ['#3b82f6', '#10b981', '#a855f7', '#06b6d4', '#f97316', '#f43f5e', '#22c55e', '#eab308']

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })
}

function isOverdueDate(iso: string | null) {
  if (!iso) return false
  return new Date(iso) < new Date()
}

// ── KPI-полоска ───────────────────────────────────────────────────────────
function KpiBar({
  stagesActive, tasksActive, overdueCount, doneStages,
}: {
  stagesActive: number; tasksActive: number; overdueCount: number; doneStages: number
}) {
  const items = [
    { label: 'Этапов в работе', value: stagesActive, accent: 'var(--color-info)' },
    { label: 'Задач в работе',  value: tasksActive,  accent: 'var(--color-info)' },
    { label: 'Просрочено',      value: overdueCount, accent: 'var(--color-danger)' },
    { label: 'Этапов завершено',value: doneStages,   accent: 'var(--color-green)' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map(i => (
        <div
          key={i.label}
          className="rounded-2xl px-4 py-3"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>{i.label}</p>
          <p className="text-2xl font-semibold num" style={{ color: i.value > 0 ? i.accent : 'var(--color-text-muted)' }}>
            {i.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Pill-статус ───────────────────────────────────────────────────────────
function StatusPill({ kind, value }: { kind: 'stage' | 'task'; value: string }) {
  const map = kind === 'stage' ? STAGE_STATUS : TASK_STATUS
  const cfg = map[value] ?? map[kind === 'stage' ? 'pending' : 'todo']
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 flex-shrink-0"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {value === 'done' && <CheckCircle2 size={11} />}
      {value === 'failed' && <AlertCircle size={11} />}
      {cfg.label}
    </span>
  )
}

// ── Строка этапа ──────────────────────────────────────────────────────────
function StageRow({ stage }: { stage: StageOverview }) {
  const overdue = isOverdueDate(stage.deadline) && stage.status !== 'completed'
  const num = String(stage.order_index + 1).padStart(2, '0')
  const projectHref = stage.project
    ? `/dashboard/projects/${stage.project.id}#stage-${stage.id}`
    : '#'

  return (
    <Link
      href={projectHref}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover-surface min-w-0"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <span className="num text-xs font-bold flex-shrink-0" style={{ color: 'var(--color-text-dim)' }}>{num}</span>
      <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--color-text)' }}>
        {stage.name}
      </span>
      {stage.checklist_total > 0 && (
        <span className="text-xs flex items-center gap-1 flex-shrink-0 num" style={{ color: 'var(--color-text-muted)' }}>
          <CheckSquare size={11} />
          {stage.checklist_done}/{stage.checklist_total}
        </span>
      )}
      {stage.documents_count > 0 && (
        <span className="text-xs flex items-center gap-1 flex-shrink-0 num" style={{ color: 'var(--color-text-muted)' }}>
          <Paperclip size={11} />
          {stage.documents_count}
        </span>
      )}
      {stage.deadline && (
        <span
          className="text-xs flex items-center gap-1 flex-shrink-0 num"
          style={{ color: overdue ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
        >
          {overdue ? <AlertTriangle size={11} /> : <Calendar size={11} />}
          {formatDate(stage.deadline)}
        </span>
      )}
      {stage.review_status && (
        <span
          className="text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0"
          style={{
            background: 'color-mix(in oklab, var(--color-warn) 12%, transparent)',
            color: 'var(--color-warn)',
            border: '1px solid color-mix(in oklab, var(--color-warn) 30%, transparent)',
          }}
        >
          {REVIEW_LABEL[stage.review_status]}
        </span>
      )}
      <StatusPill kind="stage" value={stage.status} />
    </Link>
  )
}

// ── Строка задачи ─────────────────────────────────────────────────────────
function TaskRow({ task }: { task: TaskOverview }) {
  const overdue = isOverdueDate(task.deadline) && task.status !== 'done' && task.status !== 'failed'
  const href = task.project
    ? `/dashboard/projects/${task.project.id}?view=tasks#task-${task.id}`
    : '#'

  return (
    <Link
      href={href}
      className="flex flex-col gap-1 px-3 py-2.5 rounded-lg hover-surface min-w-0"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--color-text)' }}>
          {task.title}
        </span>
        <span
          className="text-xs font-medium flex-shrink-0"
          style={{ color: PRIORITY_COLOR[task.priority] ?? 'var(--color-text-muted)' }}
        >
          {PRIORITY_LABEL[task.priority] ?? task.priority}
        </span>
        {task.deadline && (
          <span
            className="text-xs flex items-center gap-1 flex-shrink-0 num"
            style={{ color: overdue ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
          >
            {overdue ? <AlertTriangle size={11} /> : <Calendar size={11} />}
            {formatDate(task.deadline)}
          </span>
        )}
        <StatusPill kind="task" value={task.status} />
      </div>
      {task.status === 'failed' && task.employee_note && (
        <p
          className="text-xs leading-relaxed pl-0"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span style={{ color: 'var(--color-danger)' }}>Причина: </span>{task.employee_note}
        </p>
      )}
    </Link>
  )
}

// ── Группа по проекту ─────────────────────────────────────────────────────
function ProjectGroup({
  projectId, projectName, stages, tasks, doneStages, accent,
}: {
  projectId: string
  projectName: string
  stages: StageOverview[]
  tasks: TaskOverview[]
  doneStages: StageOverview[]
  accent: string
}) {
  return (
    <div
      className="rounded-2xl"
      style={{ border: `1px solid ${accent}33`, background: `${accent}08` }}
    >
      {/* Заголовок проекта */}
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="flex items-center gap-3 px-4 py-3 hover-surface rounded-t-2xl"
        style={{ borderBottom: `1px solid ${accent}18` }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}20`, color: accent }}
        >
          <FolderOpen size={15} />
        </div>
        <span className="text-base font-semibold flex-1 truncate" style={{ color: 'var(--color-text)' }}>
          {projectName}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium num flex-shrink-0"
          style={{ background: `${accent}18`, color: accent }}
        >
          {stages.length + tasks.length + doneStages.length}
        </span>
      </Link>

      <div className="p-3 space-y-4">
        {stages.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-dim)' }}>
              <Layers size={11} /> Мои этапы · {stages.length}
            </p>
            <div className="space-y-2">
              {stages.map(s => <StageRow key={s.id} stage={s} />)}
            </div>
          </div>
        )}

        {tasks.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-dim)' }}>
              <ClipboardList size={11} /> Мои задачи · {tasks.length}
            </p>
            <div className="space-y-2">
              {tasks.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          </div>
        )}

        {doneStages.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-dim)' }}>
              <CheckCircle2 size={11} /> Завершённые этапы · {doneStages.length}
            </p>
            <div className="space-y-2">
              {doneStages.map(s => <StageRow key={s.id} stage={s} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────
export default function MyWorkOverview({
  stages, tasks,
}: {
  stages: StageOverview[]
  tasks: TaskOverview[]
}) {
  if (stages.length === 0 && tasks.length === 0) {
    return (
      <EmptyState
        icon={<Layers size={36} strokeWidth={1.4} />}
        title="Нет задач по проектам"
        hint="Руководитель ещё не назначил вам этапы или задачи. Как только это произойдёт, они появятся здесь."
      />
    )
  }

  // Разделим этапы на активные/просроченные/завершённые.
  const today = new Date()
  const overdueStages = stages.filter(s => s.deadline && new Date(s.deadline) < today && s.status !== 'completed')
  const overdueTasks  = tasks.filter(t => t.deadline && new Date(t.deadline) < today && t.status !== 'done' && t.status !== 'failed')

  // Группировка по проекту. doneStages — внутрь той же группы, но отдельной подсекцией.
  type Group = { project: { id: string; name: string }; stages: StageOverview[]; tasks: TaskOverview[]; doneStages: StageOverview[] }
  const groups = new Map<string, Group>()

  function ensure(proj: { id: string; name: string } | null): Group | null {
    if (!proj) return null
    let g = groups.get(proj.id)
    if (!g) {
      g = { project: proj, stages: [], tasks: [], doneStages: [] }
      groups.set(proj.id, g)
    }
    return g
  }

  for (const s of stages) {
    const g = ensure(s.project)
    if (!g) continue
    if (s.status === 'completed') g.doneStages.push(s)
    else g.stages.push(s)
  }
  for (const t of tasks) {
    const g = ensure(t.project)
    if (!g) continue
    g.tasks.push(t)
  }

  const groupList = Array.from(groups.values())

  // Счётчики для KPI
  const stagesActive = stages.filter(s => s.status === 'in_progress').length
  const tasksActive  = tasks.filter(t => t.status === 'in_progress').length
  const doneStages   = stages.filter(s => s.status === 'completed').length
  const overdueCount = overdueStages.length + overdueTasks.length

  return (
    <div>
      <KpiBar
        stagesActive={stagesActive}
        tasksActive={tasksActive}
        overdueCount={overdueCount}
        doneStages={doneStages}
      />

      {/* Просрочки — сводно сверху */}
      {(overdueStages.length > 0 || overdueTasks.length > 0) && (
        <div
          className="rounded-2xl mb-6 p-4 space-y-2"
          style={{
            border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)',
            background: 'color-mix(in oklab, var(--color-danger) 6%, transparent)',
          }}
        >
          <p className="text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2" style={{ color: 'var(--color-danger)' }}>
            <AlertTriangle size={12} /> Просрочено · {overdueStages.length + overdueTasks.length}
          </p>
          <div className="space-y-2">
            {overdueStages.map(s => <StageRow key={s.id} stage={s} />)}
            {overdueTasks.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groupList.map((g, idx) => (
          <ProjectGroup
            key={g.project.id}
            projectId={g.project.id}
            projectName={g.project.name}
            stages={g.stages}
            tasks={g.tasks}
            doneStages={g.doneStages}
            accent={PROJECT_COLORS[idx % PROJECT_COLORS.length]}
          />
        ))}
      </div>
    </div>
  )
}
