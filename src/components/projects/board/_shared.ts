import { Layers, FileSearch, Pencil, Clipboard, MessageSquare, ShieldCheck, Package, CheckSquare } from 'lucide-react'

export type Employee = {
  id: string
  full_name: string
  role?: 'admin' | 'director' | 'manager' | 'employee' | string | null
  position?: string | null
}

export type AssigneeRef = {
  id: string
  full_name: string
  role?: string | null
  position?: string | null
}

export type ChecklistItemRef = { id: string; label: string; is_completed: boolean }

export type Stage = {
  id: string
  name: string
  order_index: number
  /** Legacy: первый ответственный (для совместимости со старым UI) */
  assignee: { id: string; full_name: string } | null
  /** Все ответственные (через junction). Опционально — для совместимости с DesignStage. */
  assignees?: AssigneeRef[]
  checklist_items: ChecklistItemRef[]
}

export type Task = {
  id: string
  title: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status?: 'todo' | 'in_progress' | 'done' | 'cancelled' | string
  stage_id: string | null
  deadline: string | null
  /** Legacy: первый исполнитель — для совместимости */
  assignee: { full_name: string } | null
  /** Все исполнители — через junction. Опционально для backward compat. */
  assignees?: AssigneeRef[]
  checklist_item_id: string | null
  checklist_item: { id: string; label: string } | null
  parent_task_id: string | null
  order_index?: number
}

/** Порядок ролей в pickers — director выше employee */
export const ROLE_ORDER: Record<string, number> = {
  admin:    0,
  director: 1,
  manager:  2,
  employee: 3,
}

/** Сортирует сотрудников: сначала по роли (директор → менеджер → сотрудник), потом по имени */
export function sortEmployeesByRole<T extends { role?: string | null; full_name: string }>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => {
    const ra = ROLE_ORDER[a.role ?? 'employee'] ?? 99
    const rb = ROLE_ORDER[b.role ?? 'employee'] ?? 99
    if (ra !== rb) return ra - rb
    return a.full_name.localeCompare(b.full_name, 'ru')
  })
}

export type StageColorTheme = {
  color: string
  bg: string
  glow: string
}

export const STAGE_COLORS: StageColorTheme[] = [
  { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  glow: 'rgba(59,130,246,0.05)'  },
  { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  glow: 'rgba(16,185,129,0.05)'  },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  glow: 'rgba(245,158,11,0.05)'  },
  { color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  glow: 'rgba(168,85,247,0.05)'  },
  { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   glow: 'rgba(6,182,212,0.05)'   },
  { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  glow: 'rgba(249,115,22,0.05)'  },
  { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   glow: 'rgba(244,63,94,0.05)'   },
  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   glow: 'rgba(34,197,94,0.05)'   },
]

export const STAGE_ICONS = [Layers, FileSearch, Pencil, Clipboard, MessageSquare, ShieldCheck, Package, CheckSquare]

export const PRIORITY_STYLE: Record<string, React.CSSProperties> = {
  low:      { background: 'var(--surface-2)',       color: 'var(--text-muted)' },
  medium:   { background: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
  high:     { background: 'rgba(249,115,22,0.12)',  color: '#fb923c' },
  critical: { background: 'rgba(239,68,68,0.12)',   color: '#f87171' },
}

export const PRIORITY_LABEL: Record<string, string> = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критичный',
}

export const PRIORITY_CONFIG = [
  { value: 'low',      label: 'Низкий',    color: 'var(--text-muted)', bg: 'var(--surface-2)',       border: 'var(--border-2)' },
  { value: 'medium',   label: 'Средний',   color: '#60a5fa',           bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)' },
  { value: 'high',     label: 'Высокий',   color: '#fb923c',           bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
  { value: 'critical', label: 'Критичный', color: '#f87171',           bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
] as const
