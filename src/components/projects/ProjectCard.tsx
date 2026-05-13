'use client'

import { ChevronRight } from 'lucide-react'
import { TransitionLink } from '@/components/ui/TransitionLink'
import { ProjectStatusPill, type ProjectStatus } from '@/components/ui/StatusPill'
import { StagePipeline } from './StagePipeline'
import type { ProjectListItem } from '@/app/dashboard/projects/actions'

const STATUS_BAR_COLOR: Record<string, string> = {
  active:    'var(--color-green)',
  on_hold:   'var(--color-warn)',
  completed: 'var(--color-info)',
  cancelled: 'var(--color-text-dim)',
}

function relativeDeadline(deadline: string): { label: string; tone: 'normal' | 'soon' | 'overdue' | 'far' } {
  const dl = new Date(deadline + (deadline.length === 10 ? 'T00:00:00' : ''))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((dl.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0)   return { label: `просрочен на ${-diffDays} дн.`, tone: 'overdue' }
  if (diffDays === 0) return { label: 'сегодня', tone: 'soon' }
  if (diffDays === 1) return { label: 'завтра', tone: 'soon' }
  if (diffDays <= 7)  return { label: `через ${diffDays} дн.`, tone: 'soon' }
  if (diffDays <= 30) return { label: `через ${diffDays} дн.`, tone: 'normal' }
  return { label: `через ${diffDays} дн.`, tone: 'far' }
}

const TONE_COLOR = {
  overdue: 'var(--color-danger)',
  soon:    'var(--color-warn)',
  normal:  'var(--color-text)',
  far:     'var(--color-text-muted)',
} as const

function managerInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const isOverdueProject = !!(project.deadline && new Date(project.deadline) < new Date() && project.status === 'active')
  const barColor = isOverdueProject
    ? 'var(--color-danger)'
    : STATUS_BAR_COLOR[project.status] ?? 'var(--color-border-2)'

  const dl = project.deadline ? relativeDeadline(project.deadline) : null
  const isCompleted = project.status === 'completed'
  const isOnHold    = project.status === 'on_hold'

  return (
    <TransitionLink
      href={`/dashboard/projects/${project.id}`}
      className={`card relative group block overflow-hidden transition-colors hover:bg-surface-2/40 hover-border
                  ${isOnHold ? 'opacity-70' : ''}
                  ${isCompleted ? 'opacity-90' : ''}`}
    >
      {/* Цветная вертикальная полоса слева — статус с одного взгляда */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: barColor }}
      />

      <div className="pl-5 pr-4 py-3.5 sm:pl-6 sm:pr-5 sm:py-4 flex flex-col gap-3 min-w-0">

        {/* ── Верхняя строка: название + статус + дедлайн + chevron ───── */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h3
                className="font-semibold text-text truncate text-[15px] sm:text-base"
                style={{ viewTransitionName: `project-title-${project.id}` } as React.CSSProperties}
              >
                {project.name}
              </h3>
              <ProjectStatusPill status={project.status as ProjectStatus} />
            </div>

            {/* Подстрока — клиент + контракт */}
            {(project.client_name || project.contract_number) && (
              <p className="mt-1 text-xs text-text-muted truncate">
                {project.client_name && <span>{project.client_name}</span>}
                {project.client_name && project.contract_number && <span className="text-text-dim mx-1.5">·</span>}
                {project.contract_number && <span className="num">№ {project.contract_number}</span>}
              </p>
            )}
          </div>

          {/* Дедлайн — компактный блок справа (только sm+) */}
          {dl && (
            <div className="text-right shrink-0 hidden sm:block min-w-[110px]">
              <p className="text-[10px] uppercase tracking-wider text-text-dim font-semibold leading-tight">Дедлайн</p>
              <p
                className="text-sm font-semibold num leading-tight mt-0.5"
                style={{ color: TONE_COLOR[dl.tone] }}
              >
                {new Date(project.deadline!).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: '2-digit', month: '2-digit', year: '2-digit' })}
              </p>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: TONE_COLOR[dl.tone] }}
              >
                {dl.label}
              </p>
            </div>
          )}

          <ChevronRight
            size={18}
            className="shrink-0 text-text-dim mt-1 transition-transform group-hover:translate-x-0.5"
          />
        </div>

        {/* ── Прогресс этапов (главное) ──────────────────────────────── */}
        <div className="min-w-0">
          {!isCompleted && project.stages && (
            <StagePipeline stages={project.stages} />
          )}
          {isCompleted && (
            <div className="flex w-full gap-1 h-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ background: 'var(--color-info)' }} />
              ))}
            </div>
          )}
        </div>

        {/* ── Нижняя мета: менеджер, бюджет, мобильный дедлайн ──────── */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted">
          {/* Дедлайн на мобильном — здесь, в одну строку */}
          {dl && (
            <span className="sm:hidden inline-flex items-center gap-1.5">
              <span className="text-text-dim">до</span>
              <span className="num font-medium" style={{ color: TONE_COLOR[dl.tone] }}>
                {new Date(project.deadline!).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: '2-digit', month: '2-digit' })}
              </span>
              <span style={{ color: TONE_COLOR[dl.tone] }}>· {dl.label}</span>
            </span>
          )}

          {project.manager?.full_name && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <span
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: 'color-mix(in oklab, var(--color-green) 18%, transparent)',
                  color: 'var(--color-green)',
                }}
                title={project.manager.full_name}
              >
                {managerInitials(project.manager.full_name)}
              </span>
              <span className="hidden md:inline truncate">{project.manager.full_name}</span>
            </span>
          )}

          {project.budget != null && (
            <span className="num hidden lg:inline">
              {Number(project.budget).toLocaleString('ru-RU')} ₸
            </span>
          )}
        </div>
      </div>
    </TransitionLink>
  )
}
