'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  TrendingDown,
  Users,
  FolderKanban,
  Clock,
  Flame,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Zap,
} from 'lucide-react'

/* ─── Типы данных ─── */

export interface BottleneckEmployee {
  id: string
  fullName: string
  position: string | null
  overdueTasks: number
  totalActiveTasks: number
  avgOverdueDays: number // Среднее кол-во дней просрочки
  taskTitles: string[]    // Названия просроченных задач (для раскрытия)
}

export interface BottleneckProject {
  id: string
  name: string
  managerName: string
  overdueTasksCount: number
  totalTasksCount: number
  avgOverdueDays: number
  isProjectOverdue: boolean // Сам проект просрочен?
  projectDeadline: string | null
}

export interface StatusDistribution {
  status: string
  label: string
  count: number
  color: string
}

export interface BottleneckSummary {
  totalOverdueTasks: number
  totalActiveTasksWithDeadline: number
  overdueProjects: number
  totalActiveProjects: number
  avgOverdueDays: number
  longestOverdueTask: { title: string; days: number } | null
}

interface Props {
  employees: BottleneckEmployee[]
  projects: BottleneckProject[]
  statusDistribution: StatusDistribution[]
  summary: BottleneckSummary
}

/* ─── Главный компонент ─── */

export default function BottlenecksDashboard({
  employees,
  projects,
  statusDistribution,
  summary,
}: Props) {
  const [activeTab, setActiveTab] = useState<'employees' | 'projects'>('employees')

  // % просроченных от общего с дедлайнами
  const overduePercent = summary.totalActiveTasksWithDeadline > 0
    ? Math.round((summary.totalOverdueTasks / summary.totalActiveTasksWithDeadline) * 100)
    : 0

  return (
    <div className="space-y-8">
      {/* ═══ Саммари-плашки ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Flame size={20} />}
          label="Просроченных задач"
          value={summary.totalOverdueTasks}
          sub={`${overduePercent}% от задач с дедлайнами`}
          color="#ef4444"
          bg="rgba(239,68,68,0.1)"
        />
        <SummaryCard
          icon={<FolderKanban size={20} />}
          label="Горящих проектов"
          value={summary.overdueProjects}
          sub={`из ${summary.totalActiveProjects} активных`}
          color="#f97316"
          bg="rgba(249,115,22,0.1)"
        />
        <SummaryCard
          icon={<Clock size={20} />}
          label="Средн. просрочка"
          value={`${summary.avgOverdueDays} дн.`}
          sub="среди просроченных задач"
          color="#eab308"
          bg="rgba(234,179,8,0.1)"
        />
        <SummaryCard
          icon={<TrendingDown size={20} />}
          label="Макс. просрочка"
          value={summary.longestOverdueTask ? `${summary.longestOverdueTask.days} дн.` : '—'}
          sub={summary.longestOverdueTask?.title ? truncate(summary.longestOverdueTask.title, 30) : 'Нет просроченных'}
          color="#8b5cf6"
          bg="rgba(139,92,246,0.1)"
        />
      </div>

      {/* ═══ Распределение по статусам ═══ */}
      <div className="p-6 rounded-2xl bg-[color:var(--surface-2)] border border-[color:var(--border)]">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 size={18} className="text-[color:var(--text-muted)]" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-[color:var(--text-muted)]">
            Распределение задач по статусам
          </h3>
        </div>
        <StatusBar items={statusDistribution} />
      </div>

      {/* ═══ Переключатель табов ═══ */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('employees')}
          className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            backgroundColor: activeTab === 'employees' ? '#ef4444' : 'var(--surface-2)',
            color: activeTab === 'employees' ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${activeTab === 'employees' ? '#ef4444' : 'var(--border)'}`,
          }}
        >
          <Users size={14} className="inline mr-2" />
          Люди-узлы ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            backgroundColor: activeTab === 'projects' ? '#f97316' : 'var(--surface-2)',
            color: activeTab === 'projects' ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${activeTab === 'projects' ? '#f97316' : 'var(--border)'}`,
          }}
        >
          <FolderKanban size={14} className="inline mr-2" />
          Проекты-проблемы ({projects.length})
        </button>
      </div>

      {/* ═══ Контент таба ═══ */}
      {activeTab === 'employees' && (
        <EmployeeBottleneckList employees={employees} />
      )}
      {activeTab === 'projects' && (
        <ProjectBottleneckList projects={projects} />
      )}
    </div>
  )
}

/* ─── Компонент суммарной плашки ─── */

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
  bg: _bg,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  color: string
  bg: string
}) {
  return (
    <div
      className="p-5 rounded-2xl border relative overflow-hidden group hover:scale-[1.02] transition-transform"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="absolute -top-3 -right-3 w-16 h-16 rounded-full opacity-10 group-hover:opacity-20 transition-opacity"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-center gap-2 mb-3" style={{ color }}>
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-black text-[color:var(--text)] mb-1">{value}</div>
      <div className="text-xs text-[color:var(--text-muted)]">{sub}</div>
    </div>
  )
}

/* ─── Горизонтальный бар статусов ─── */

function StatusBar({ items }: { items: StatusDistribution[] }) {
  const total = items.reduce((s, i) => s + i.count, 0)
  if (total === 0) {
    return <div className="text-sm text-[color:var(--text-muted)] italic">Нет данных</div>
  }

  return (
    <div className="space-y-3">
      {/* Сам бар */}
      <div className="flex rounded-xl overflow-hidden h-8 shadow-inner">
        {items.map((item) => {
          const pct = Math.round((item.count / total) * 100)
          if (pct === 0) return null
          return (
            <div
              key={item.status}
              className="flex items-center justify-center text-[11px] font-bold text-white transition-all hover:brightness-110"
              style={{
                width: `${pct}%`,
                backgroundColor: item.color,
                minWidth: pct > 3 ? undefined : '24px',
              }}
              title={`${item.label}: ${item.count} (${pct}%)`}
            >
              {pct >= 8 && `${pct}%`}
            </div>
          )
        })}
      </div>
      {/* Легенда */}
      <div className="flex flex-wrap gap-4">
        {items.map((item) => (
          <div key={item.status} className="flex items-center gap-2 text-sm text-[color:var(--text)]">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="font-medium">{item.label}</span>
            <span className="text-[color:var(--text-muted)]">({item.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Список сотрудников-узких мест ─── */

function EmployeeBottleneckList({ employees }: { employees: BottleneckEmployee[] }) {
  if (employees.length === 0) {
    return (
      <div className="p-10 border border-dashed rounded-2xl text-center text-[color:var(--text-muted)]">
        <Zap size={32} className="mx-auto mb-3 opacity-30" />
        <p className="font-semibold">Ни одного просроченного сотрудника!</p>
        <p className="text-sm mt-1 opacity-70">Все задачи сдаются вовремя. Отличная работа.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {employees.map((emp, idx) => (
        <EmployeeRow key={emp.id} employee={emp} rank={idx + 1} />
      ))}
    </div>
  )
}

function EmployeeRow({ employee, rank }: { employee: BottleneckEmployee; rank: number }) {
  const [expanded, setExpanded] = useState(false)

  // Отношение просроченных к общему — серьезность
  const severity = employee.totalActiveTasks > 0
    ? Math.round((employee.overdueTasks / employee.totalActiveTasks) * 100)
    : 0

  // Цвет по серьезности
  const sevColor = severity >= 60 ? '#ef4444' : severity >= 30 ? '#f97316' : '#eab308'

  return (
    <div
      className="p-4 rounded-2xl border bg-[color:var(--surface)] transition-all hover:shadow-md cursor-pointer"
      style={{ borderLeftWidth: '4px', borderLeftColor: sevColor }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-4">
        {/* Позиция в рейтинге */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
          style={{ backgroundColor: sevColor }}
        >
          {rank}
        </div>

        {/* Имя и должность */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[color:var(--text)] truncate">{employee.fullName}</div>
          <div className="text-xs text-[color:var(--text-muted)]">
            {employee.position || 'Должность не указана'}
          </div>
        </div>

        {/* Метрики */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <div className="text-xl font-black" style={{ color: sevColor }}>
              {employee.overdueTasks}
            </div>
            <div className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider">
              Просроч.
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-[color:var(--text)]">
              {employee.totalActiveTasks}
            </div>
            <div className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider">
              Всего
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black" style={{ color: sevColor }}>
              ~{employee.avgOverdueDays}
            </div>
            <div className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider">
              Дней
            </div>
          </div>
          <div
            className="px-3 py-1 rounded-lg text-xs font-bold"
            style={{ backgroundColor: `${sevColor}15`, color: sevColor }}
          >
            {severity}% просрочены
          </div>
          {expanded ? (
            <ChevronUp size={18} className="text-[color:var(--text-muted)]" />
          ) : (
            <ChevronDown size={18} className="text-[color:var(--text-muted)]" />
          )}
        </div>
      </div>

      {/* Раскрытие — список задач */}
      {expanded && employee.taskTitles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[color:var(--border)]">
          <div className="text-xs font-bold text-[color:var(--text-muted)] uppercase tracking-wider mb-2">
            Просроченные задачи:
          </div>
          <ul className="space-y-1.5">
            {employee.taskTitles.map((title, i) => (
              <li
                key={i}
                className="text-sm text-[color:var(--text)] flex items-center gap-2"
              >
                <AlertTriangle size={12} style={{ color: sevColor }} className="shrink-0" />
                <span className="truncate">{title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ─── Список проектов-проблем ─── */

function ProjectBottleneckList({ projects }: { projects: BottleneckProject[] }) {
  if (projects.length === 0) {
    return (
      <div className="p-10 border border-dashed rounded-2xl text-center text-[color:var(--text-muted)]">
        <Zap size={32} className="mx-auto mb-3 opacity-30" />
        <p className="font-semibold">Все проекты в графике!</p>
        <p className="text-sm mt-1 opacity-70">Ни одного проекта с просроченными задачами.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {projects.map((proj, idx) => (
        <ProjectRow key={proj.id} project={proj} rank={idx + 1} />
      ))}
    </div>
  )
}

function ProjectRow({ project, rank }: { project: BottleneckProject; rank: number }) {
  const pct = project.totalTasksCount > 0
    ? Math.round((project.overdueTasksCount / project.totalTasksCount) * 100)
    : 0

  const sevColor = project.isProjectOverdue
    ? '#ef4444'
    : pct >= 50
      ? '#ef4444'
      : pct >= 25
        ? '#f97316'
        : '#eab308'

  return (
    <div
      className="p-5 rounded-2xl border bg-[color:var(--surface)] hover:shadow-md transition-all"
      style={{ borderLeftWidth: '4px', borderLeftColor: sevColor }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
          style={{ backgroundColor: sevColor }}
        >
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[color:var(--text)] truncate">{project.name}</span>
            {project.isProjectOverdue && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 uppercase tracking-wider shrink-0">
                Проект просрочен
              </span>
            )}
          </div>
          <div className="text-xs text-[color:var(--text-muted)] mt-0.5">
            ПМ: {project.managerName}
            {project.projectDeadline && (
              <> · Дедлайн: {new Date(project.projectDeadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <div className="text-xl font-black" style={{ color: sevColor }}>
              {project.overdueTasksCount}
            </div>
            <div className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider">
              Просроч.
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-[color:var(--text)]">{project.totalTasksCount}</div>
            <div className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider">
              Задач
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black" style={{ color: sevColor }}>
              ~{project.avgOverdueDays}
            </div>
            <div className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider">
              Дней
            </div>
          </div>

          {/* Мини прогресс-бар */}
          <div className="w-20 flex flex-col items-end gap-1">
            <div className="w-full h-2 rounded-full bg-[color:var(--border)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: sevColor }}
              />
            </div>
            <span className="text-[10px] font-bold" style={{ color: sevColor }}>
              {pct}% просрочены
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Утилиты ─── */

function truncate(str: string, max: number) {
  return str.length > max ? str.substring(0, max) + '…' : str
}
