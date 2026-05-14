import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Gauge, AlertTriangle, Zap, ClipboardList, Send, FileText } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader, CardEmpty } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import {
  TaskStatusPill, PriorityLabel, TASK_STATUS_CONFIG,
  type TaskStatus, type TaskPriority,
} from '@/components/ui/StatusPill'
import { getUserWip } from '@/lib/wip'
import {
  getMyDirectTaskCounts, getMyProjectTaskCounts, getMyOverdueCounts,
} from '../queries'

export const revalidate = 30

// ─── WIP-карточка ─────────────────────────────────────────────────────────
async function WipCard({ userId }: { userId: string }) {
  const supabase = await createClient()
  const wip = await getUserWip(supabase, userId)

  const tone =
    wip.state === 'over'    ? { bg: 'var(--color-danger)', label: 'Перегрузка', alert: 'danger' as const }
    : wip.state === 'warning' ? { bg: 'var(--color-warn)',   label: 'Близко к лимиту', alert: 'warn'   as const }
    : { bg: 'var(--color-green)', label: 'В норме', alert: 'green' as const }

  const pct = wip.limit > 0 ? Math.min(100, Math.round((wip.active / wip.limit) * 100)) : 0

  return (
    <Card>
      <CardHeader icon={<Gauge size={18} />} title="Моя загрузка" />
      <div className="p-4 md:p-6">
        <div className="flex items-end gap-4 mb-4">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold leading-none num tracking-tight text-text">
                {wip.active}
              </span>
              <span className="text-2xl font-semibold num text-text-dim">
                /{wip.limit}
              </span>
            </div>
            <p className="text-xs mt-2 text-text-muted">задач в работе</p>
          </div>
          <span
            className="ml-auto text-xs font-semibold px-2 py-1 rounded-full"
            style={{
              background: `color-mix(in oklab, ${tone.bg} 15%, transparent)`,
              color: tone.bg,
              border: `1px solid color-mix(in oklab, ${tone.bg} 30%, transparent)`,
            }}
          >
            {tone.label}
          </span>
        </div>
        {/* Прогресс-бар */}
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: 'var(--color-surface-2)' }}
        >
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${pct}%`, background: tone.bg }}
          />
        </div>
        <p className="text-xs mt-3 text-text-dim">
          {wip.state === 'over' && 'Завершите часть текущих задач, прежде чем брать новые.'}
          {wip.state === 'warning' && 'Лимит почти достигнут — не берите больше задач без необходимости.'}
          {wip.state === 'ok' && 'Можно брать новые задачи в работу.'}
        </p>
      </div>
    </Card>
  )
}

// ─── Статусы задач в проектах ─────────────────────────────────────────────
function TaskStatusRow({ counts, title, href }: {
  counts: Record<string, number>; title: string; href: string
}) {
  const statuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
  return (
    <Card>
      <CardHeader
        icon={<ClipboardList size={18} />}
        title={title}
        action={<Link href={href} className="text-xs font-medium hover-green text-text-dim">Открыть →</Link>}
      />
      <div className="grid grid-cols-2 @md:grid-cols-4 divide-x divide-y @md:divide-y-0 divide-[color:var(--color-border)]">
        {statuses.map(s => {
          const cfg = TASK_STATUS_CONFIG[s]
          const count = counts[s] ?? 0
          const tone = cfg.tone
          const color =
            tone === 'green' ? 'var(--color-green)'
            : tone === 'info'  ? 'var(--color-info)'
            : tone === 'warn'  ? 'var(--color-warn)'
            : 'var(--color-text-muted)'
          return (
            <div key={s} className="flex flex-col items-center justify-center py-5 gap-1.5">
              <div className="flex items-center gap-1.5" style={{ color }}>
                <span className="scale-125">{cfg.icon}</span>
                <span className="text-2xl font-bold leading-none num">{count}</span>
              </div>
              <p className="text-xs text-center px-1 text-text-dim">{cfg.label}</p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Список «в работе сейчас» ─────────────────────────────────────────────
type ActiveItem = {
  id: string
  title: string
  priority: TaskPriority
  status: TaskStatus
  deadline: string | null
  project?: { name: string } | null
  kind: 'direct' | 'project'
}

function ActiveTasksCard({ items }: { items: ActiveItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader icon={<Zap size={18} />} title="В работе сейчас" />
        <CardEmpty icon={<Zap size={40} />} text="Сейчас нет активных задач" />
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader icon={<Zap size={18} />} iconColor="var(--color-info)" title="В работе сейчас" count={items.length} countTone="info" />
      <div>
        {items.map((it, i) => {
          const isOverdue = it.deadline && new Date(it.deadline) < new Date() && it.status !== 'done'
          const href = it.kind === 'direct' ? '/dashboard/assignments' : '/dashboard/tasks'
          return (
            <Link
              key={`${it.kind}-${it.id}`}
              href={href}
              className="block px-4 py-3 @md:px-6 hover-surface transition-colors"
              style={{ borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : undefined }}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-text">{it.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-text-dim border border-border">
                      {it.kind === 'direct' ? 'Поручение' : 'Задача в проекте'}
                    </span>
                    {it.project && (
                      <span className="text-xs text-text-dim truncate">
                        {it.project.name}
                      </span>
                    )}
                    <PriorityLabel priority={it.priority} />
                    {it.deadline && (
                      <span className={`text-xs num ${isOverdue ? 'text-danger' : 'text-text-dim'}`}>
                        {isOverdue ? '⚠ ' : ''}
                        {new Date(it.deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                <TaskStatusPill status={it.status} />
              </div>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Быстрые действия ─────────────────────────────────────────────────────
function QuickActions() {
  const items = [
    { href: '/dashboard/daily',       icon: <FileText size={18} />,      color: 'var(--color-green)',  title: 'Подать дейли',  subtitle: 'Отчёт за день' },
    { href: '/dashboard/tasks',       icon: <ClipboardList size={18} />, color: 'var(--color-info)',   title: 'Мои задачи',    subtitle: 'Все задачи в проектах' },
    { href: '/dashboard/assignments', icon: <Send size={18} />,          color: 'var(--color-warn)',   title: 'Мои поручения', subtitle: 'Прямые поручения' },
  ]
  return (
    <Card>
      <CardHeader icon={<Zap size={18} />} title="Быстрые действия" />
      <div className="p-4 md:p-6 grid grid-cols-1 gap-3">
        {items.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover-surface transition-colors"
          >
            <span style={{ color: a.color }}>{a.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">{a.title}</p>
              <p className="text-xs text-text-dim">{a.subtitle}</p>
            </div>
            <span className="ml-auto text-text-dim">→</span>
          </Link>
        ))}
      </div>
    </Card>
  )
}

// ─── Async-секция: алерт о просрочках + контент ───────────────────────────
async function MeContent({ userId }: { userId: string }) {
  const supabase = await createClient()
  const [projectCounts, directCounts, overdue, activeDirect, activeProject] = await Promise.all([
    getMyProjectTaskCounts(userId),
    getMyDirectTaskCounts(userId),
    getMyOverdueCounts(userId),
    supabase.from('direct_tasks')
      .select('id, title, priority, status, deadline')
      .eq('assignee_id', userId)
      .eq('status', 'in_progress')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(10),
    supabase.from('project_tasks')
      .select('id, title, priority, status, deadline, project:projects!project_tasks_project_id_fkey(name)')
      .eq('assignee_id', userId)
      .eq('status', 'in_progress')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(10),
  ])

  const totalOverdue = overdue.direct + overdue.project

  const active: ActiveItem[] = [
    ...((activeDirect.data ?? []) as { id: string; title: string; priority: string; status: string; deadline: string | null }[])
      .map(t => ({
        id: t.id, title: t.title,
        priority: t.priority as TaskPriority,
        status: t.status as TaskStatus,
        deadline: t.deadline,
        kind: 'direct' as const,
      })),
    ...((activeProject.data ?? []) as unknown as { id: string; title: string; priority: string; status: string; deadline: string | null; project: { name: string } | { name: string }[] | null }[])
      .map(t => ({
        id: t.id, title: t.title,
        priority: t.priority as TaskPriority,
        status: t.status as TaskStatus,
        deadline: t.deadline,
        project: Array.isArray(t.project) ? (t.project[0] ?? null) : t.project,
        kind: 'project' as const,
      })),
  ]
    // ближайший дедлайн — раньше; null — в конце
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline.localeCompare(b.deadline)
    })

  return (
    <>
      {totalOverdue > 0 && (
        <div className="mb-5">
          <Alert
            tone="danger"
            icon={<AlertTriangle size={16} />}
            href={overdue.direct > 0 ? '/dashboard/assignments' : '/dashboard/tasks'}
            actionLabel="Открыть"
          >
            Просрочено: {overdue.direct > 0 && `${overdue.direct} ${overdue.direct === 1 ? 'поручение' : 'поручений'}`}
            {overdue.direct > 0 && overdue.project > 0 && ', '}
            {overdue.project > 0 && `${overdue.project} ${overdue.project === 1 ? 'задача' : 'задач'}`}
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
        <WipCard userId={userId} />
        <QuickActions />
        <TaskStatusRow counts={projectCounts} title="Задачи в проектах" href="/dashboard/tasks" />
        <TaskStatusRow counts={directCounts}  title="Поручения"         href="/dashboard/assignments" />
      </div>

      <div className="mt-4 md:mt-6">
        <ActiveTasksCard items={active} />
      </div>
    </>
  )
}

// ─── Страница ─────────────────────────────────────────────────────────────
export default async function MePage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  // Директор пусть пользуется /dashboard/workload, у него другой view.
  if (profile.role === 'director' || profile.role === 'admin') redirect('/dashboard/workload')

  return (
    <div>
      <PageHeader
        icon={<Gauge size={18} />}
        iconTone="info"
        title="Моя загрузка"
        subtitle="WIP-лимит, активные задачи и просрочка"
      />
      <Suspense fallback={<div className="h-96 rounded-2xl bg-surface-2/40 animate-pulse" />}>
        <MeContent userId={profile.id} />
      </Suspense>
    </div>
  )
}
