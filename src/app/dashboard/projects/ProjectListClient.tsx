'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { AlertTriangle, ChevronDown, CheckCircle2 } from 'lucide-react'
import { LoadMore } from '@/components/ui/LoadMore'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { ProjectsTable } from '@/components/projects/ProjectsTable'
import { ProjectsEmptyState } from '@/components/projects/ProjectsEmptyState'
import {
  ProjectsToolbar,
  type ProjectStatusFilter,
  type ProjectSort,
  type ProjectView,
} from '@/components/projects/ProjectsToolbar'
import { fetchProjectsPage, fetchMyProjectsPage, type ProjectListItem } from './actions'

const PAGE_SIZE = 20

export default function ProjectListClient({
  initial,
  total,
  filterByManagerId,
  employeeUserId,
  canCreate,
  viewerRole,
}: {
  initial: ProjectListItem[]
  total: number
  filterByManagerId: string | null
  /** Если задан — load-more идёт через RPC get_my_projects_page (роль employee). */
  employeeUserId: string | null
  canCreate: boolean
  viewerRole: 'admin' | 'director' | 'manager' | 'employee'
}) {
  // Полностью пустой список — показываем «крупный» empty state без toolbar.
  if (initial.length === 0 && total === 0) {
    const kind =
      viewerRole === 'manager' || viewerRole === 'employee' ? 'no-assigned' : 'no-projects'
    return (
      <ProjectsEmptyState
        kind={kind}
        canCreate={canCreate}
      />
    )
  }

  return (
    <LoadMore<ProjectListItem>
      initial={initial}
      pageSize={PAGE_SIZE}
      fetchMore={(page) => employeeUserId
        ? fetchMyProjectsPage(employeeUserId, page, PAGE_SIZE).then(r => r.rows)
        : fetchProjectsPage(page, PAGE_SIZE, filterByManagerId, false)
      }
      emptyMessage=""
      renderItems={(items) => <FilteredList items={items} total={total} />}
    />
  )
}

function FilteredList({ items, total }: { items: ProjectListItem[]; total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const q       = (search.get('q') ?? '').trim().toLowerCase()
  const status  = (search.get('status') as ProjectStatusFilter) ?? 'all'
  const sort    = (search.get('sort')   as ProjectSort)         ?? 'created_desc'
  const view    = (search.get('view')   as ProjectView)         ?? 'list'

  const [showCompleted, setShowCompleted] = useState(false)

  const groups = useMemo(() => {
    const today = Date.now()
    const inWeek = today + 7 * 86400000
    let pool = items.slice()

    // Поиск
    if (q) {
      pool = pool.filter(p =>
        p.name.toLowerCase().includes(q)
        || (p.client_name?.toLowerCase().includes(q) ?? false)
        || (p.contract_number?.toLowerCase().includes(q) ?? false),
      )
    }

    // Если выбран явный фильтр — отдаём только подмножество (без группировки)
    if (status !== 'all') {
      let pick = pool
      if (status === 'overdue') {
        pick = pool.filter(p =>
          p.deadline && new Date(p.deadline).getTime() < today && p.status === 'active',
        )
      } else {
        pick = pool.filter(p => p.status === status)
      }
      pick.sort(SORTS[sort] ?? SORTS.created_desc)
      return { mode: 'flat' as const, items: pick }
    }

    // По умолчанию — группируем
    const attention: ProjectListItem[] = []
    const active:    ProjectListItem[] = []
    const onHold:    ProjectListItem[] = []
    const completed: ProjectListItem[] = []

    for (const p of pool) {
      if (p.status === 'cancelled') continue
      if (p.status === 'completed') { completed.push(p); continue }

      const dlTime = p.deadline ? new Date(p.deadline).getTime() : null
      const isOverdue       = dlTime != null && dlTime < today    && p.status === 'active'
      const isDeadlineSoon  = dlTime != null && dlTime < inWeek   && dlTime >= today && p.status === 'active'
      const hasReviewStage  = p.stages?.some(s => s.review_status === 'pending_review')
      const hasOverdueStage = p.stages?.some(s =>
        s.deadline && new Date(s.deadline).getTime() < today && s.status !== 'completed',
      )

      if (isOverdue || isDeadlineSoon || hasReviewStage || hasOverdueStage) {
        attention.push(p)
      } else if (p.status === 'on_hold') {
        onHold.push(p)
      } else {
        active.push(p)
      }
    }

    const sortFn = SORTS[sort] ?? SORTS.created_desc
    // В «Требуют внимания» приоритет — горящее сверху
    attention.sort((a, b) => deadlineKey(a) - deadlineKey(b))
    active.sort(sortFn)
    onHold.sort(sortFn)
    completed.sort(sortFn)

    return { mode: 'grouped' as const, attention, active, onHold, completed }
  }, [items, q, status, sort])

  const visibleCount =
    groups.mode === 'flat'
      ? groups.items.length
      : groups.attention.length + groups.active.length + groups.onHold.length + groups.completed.length

  // Для табличного режима — плоский список
  const flatAll = useMemo(() => {
    if (groups.mode === 'flat') return groups.items
    return [...groups.attention, ...groups.active, ...groups.onHold, ...groups.completed]
  }, [groups])

  const gridClass = view === 'grid'
    ? 'grid grid-cols-1 xl:grid-cols-2 gap-3'
    : 'grid grid-cols-1 gap-3'

  // Табличный режим — полностью отдельный рендер
  if (view === 'table') {
    return (
      <>
        <ProjectsToolbar total={total} visible={visibleCount} />
        {flatAll.length === 0
          ? <ProjectsEmptyState kind="no-results" onReset={() => router.replace(pathname, { scroll: false })} />
          : <ProjectsTable items={flatAll} />}
      </>
    )
  }

  return (
    <>
      <ProjectsToolbar total={total} visible={visibleCount} />

      {groups.mode === 'flat' ? (
        groups.items.length > 0 ? (
          <div className={gridClass}>
            {groups.items.map(project => <ProjectCard key={project.id} project={project} />)}
          </div>
        ) : (
          <ProjectsEmptyState kind="no-results" onReset={() => router.replace(pathname, { scroll: false })} />
        )
      ) : (
        <>
          {groups.attention.length > 0 && (
            <Section
              tone="danger"
              icon={<AlertTriangle size={16} />}
              title="Требуют внимания"
              count={groups.attention.length}
              hint="просрочка, дедлайн в течение недели или этапы на проверке"
              gridClass={gridClass}
            >
              {groups.attention.map(p => <ProjectCard key={p.id} project={p} />)}
            </Section>
          )}

          {groups.active.length > 0 && (
            <Section
              icon={<span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--color-green)' }} />}
              title="В работе"
              count={groups.active.length}
              gridClass={gridClass}
            >
              {groups.active.map(p => <ProjectCard key={p.id} project={p} />)}
            </Section>
          )}

          {groups.onHold.length > 0 && (
            <Section
              icon={<span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--color-warn)' }} />}
              title="На паузе"
              count={groups.onHold.length}
              gridClass={gridClass}
            >
              {groups.onHold.map(p => <ProjectCard key={p.id} project={p} />)}
            </Section>
          )}

          {groups.completed.length > 0 && (
            <section className="mt-6">
              <button
                type="button"
                onClick={() => setShowCompleted(o => !o)}
                className="w-full flex items-center gap-2 px-1 py-2 text-text-muted hover:text-text transition-colors"
              >
                <CheckCircle2 size={16} className="text-info" />
                <span className="text-sm font-semibold">Завершённые</span>
                <span className="num text-xs text-text-dim">{groups.completed.length}</span>
                <ChevronDown
                  size={16}
                  className={`ml-auto text-text-dim transition-transform ${showCompleted ? 'rotate-180' : ''}`}
                />
              </button>
              {showCompleted && (
                <div className={`${gridClass} mt-2 animate-fade-up`}>
                  {groups.completed.map(p => <ProjectCard key={p.id} project={p} />)}
                </div>
              )}
            </section>
          )}

          {visibleCount === 0 && items.length > 0 && <ProjectsEmptyState kind="no-results" onReset={() => router.replace(pathname, { scroll: false })} />}
        </>
      )}
    </>
  )
}

function Section({
  tone, icon, title, count, hint, gridClass = 'grid grid-cols-1 gap-3', children,
}: {
  tone?: 'danger' | 'warn'
  icon?: React.ReactNode
  title: string
  count: number
  hint?: string
  gridClass?: string
  children: React.ReactNode
}) {
  const ringColor =
    tone === 'danger' ? 'var(--color-danger)'
    : tone === 'warn'   ? 'var(--color-warn)'
    : undefined

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2 px-1">
        {icon && (
          <span className="shrink-0" style={{ color: ringColor ?? 'var(--color-text-muted)' }}>
            {icon}
          </span>
        )}
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <span
          className="num text-[11px] font-bold px-1.5 py-0.5 rounded-full border"
          style={{
            background: ringColor
              ? `color-mix(in oklab, ${ringColor} 12%, transparent)`
              : 'var(--color-surface-2)',
            borderColor: ringColor
              ? `color-mix(in oklab, ${ringColor} 30%, transparent)`
              : 'var(--color-border-2)',
            color: ringColor ?? 'var(--color-text-muted)',
          }}
        >
          {count}
        </span>
        {hint && <p className="text-xs text-text-dim ml-2 truncate hidden md:block">{hint}</p>}
      </div>
      <div className={gridClass}>
        {children}
      </div>
    </section>
  )
}


const SORTS: Record<ProjectSort, (a: ProjectListItem, b: ProjectListItem) => number> = {
  created_desc:  (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  created_asc:   (a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  deadline_asc:  (a, b) => deadlineKey(a) - deadlineKey(b),
  deadline_desc: (a, b) => deadlineKey(b, true) - deadlineKey(a, true),
  name_asc:      (a, b) => a.name.localeCompare(b.name, 'ru'),
  budget_desc:   (a, b) => (b.budget ?? -1) - (a.budget ?? -1),
}

function deadlineKey(p: ProjectListItem, far = false): number {
  if (!p.deadline) return far ? -Infinity : Infinity
  return new Date(p.deadline).getTime()
}
