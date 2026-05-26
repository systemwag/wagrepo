import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/supabase/server'
import {
  FolderOpen, Users, ClipboardList,
  AlertTriangle, Zap, Send,
} from 'lucide-react'
import { todayOral, currentHourOral } from '@/lib/utils/date'
import { formatNameShort, getFirstName } from '@/lib/utils/name'
import { Card, CardHeader, CardEmpty } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import {
  TaskStatusPill, PriorityLabel, TASK_STATUS_CONFIG,
  type TaskStatus, type TaskPriority,
} from '@/components/ui/StatusPill'

import { hasDirectorAccess } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

import EventsCard         from './sections/EventsCard'
import BirthdaysCard      from './sections/BirthdaysCard'
import RecentActivityCard from './sections/RecentActivityCard'
import SilentEmployeesCard from './sections/SilentEmployeesCard'
import DailyCta           from './sections/DailyCta'
import PollsCta           from './sections/PollsCta'
import {
  StatsSkeleton, CardListSkeleton, CtaSkeleton,
} from './sections/skeletons'

// Чтобы greeting и сегодняшние счётчики были свежими каждые 30 сек.
export const revalidate = 30

// ─── Хедер ───────────────────────────────────────────────────────────────────

function GreetingHeader({ greeting, firstName }: { greeting: string; firstName: string }) {
  const dateStr = new Date().toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Oral', weekday: 'long', day: 'numeric', month: 'long',
  })
  return (
    <header className="mb-6 pr-12 md:pr-0 flex items-end justify-between gap-4 flex-wrap">
      <h1 className="text-xl md:text-2xl font-semibold text-text leading-tight">
        {greeting}, <span className="text-green">{firstName}</span>
      </h1>
      <p className="text-sm text-text-muted first-letter:uppercase">
        {dateStr}
      </p>
    </header>
  )
}

// ─── Маленькие переиспользуемые блоки ────────────────────────────────────────

function StatCard({ icon, label, value, href, accent }: {
  icon: React.ReactNode; label: string; value: number | string; href?: string; accent?: boolean
}) {
  // V2: число — главное. Крупный шрифт, иконка справа меньше и тише.
  const content = (
    <Card className="flex items-center justify-between gap-3 px-4 py-4 md:px-5 md:py-5" accent={accent}>
      <div className="min-w-0">
        <p className={`text-4xl font-bold leading-none num tracking-tight ${accent ? 'text-green' : 'text-text'}`}>
          {value}
        </p>
        <p className="text-xs mt-2 truncate text-text-muted">{label}</p>
      </div>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 opacity-70"
        style={{
          background: accent
            ? 'color-mix(in oklab, var(--color-green) 12%, transparent)'
            : 'var(--color-surface-2)',
          color: accent ? 'var(--color-green)' : 'var(--color-text-dim)',
        }}
      >
        {icon}
      </div>
    </Card>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function QuickAction({ href, icon, iconColor, title, subtitle }: {
  href: string; icon: React.ReactNode; iconColor: string; title: string; subtitle: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover-surface transition-colors"
    >
      <span style={{ color: iconColor }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="text-xs text-text-dim">{subtitle}</p>
      </div>
      <span className="ml-auto text-text-dim">→</span>
    </Link>
  )
}

function TaskStatusRow({ counts }: { counts: Record<string, number> }) {
  const statuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
  return (
    <Card>
      <CardHeader
        icon={<ClipboardList size={18} />}
        title="Работа по проекту"
        action={<Link href="/dashboard/tasks" className="text-xs font-medium hover-green text-text-dim">Открыть →</Link>}
      />
      <div className="grid grid-cols-4 divide-x divide-[color:var(--color-border)]">
        {statuses.map(s => {
          const cfg = TASK_STATUS_CONFIG[s]
          const count = counts[s] ?? 0
          const tone = cfg.tone
          const color =
            tone === 'green'  ? 'var(--color-green)'
            : tone === 'info'   ? 'var(--color-info)'
            : tone === 'warn'   ? 'var(--color-warn)'
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

function AssignedTasksCard({ tasks }: {
  tasks: { id: string; title: string; priority: string; status: string; deadline: string | null; creator: { full_name: string } | null }[]
}) {
  if (tasks.length === 0) return (
    <Card>
      <CardHeader icon={<Send size={18} />} iconColor="var(--color-warn)" title="Поручения" />
      <CardEmpty icon={<Send size={40} />} text="Поручений пока нет" />
    </Card>
  )

  return (
    <Card>
      <CardHeader
        icon={<Send size={18} />}
        iconColor="var(--color-warn)"
        title="Поручения"
        count={tasks.length}
        countTone="warn"
      />
      <div>
        {tasks.map((task, i) => {
          const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'
          return (
            <div
              key={task.id}
              className="px-4 py-3 @md:px-6"
              style={{ borderBottom: i < tasks.length - 1 ? '1px solid var(--color-border)' : undefined }}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-text">{task.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <PriorityLabel priority={task.priority as TaskPriority} />
                    {task.deadline && (
                      <span className={`text-xs num ${isOverdue ? 'text-danger' : 'text-text-dim'}`}>
                        {isOverdue ? '⚠ ' : ''}
                        {new Date(task.deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {task.creator && (
                      <span className="text-xs text-text-dim">
                        от {formatNameShort(task.creator.full_name)}
                      </span>
                    )}
                  </div>
                </div>
                <TaskStatusPill status={task.status as TaskStatus} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-3 md:px-6 border-t border-border">
        <Link href="/dashboard/tasks" className="text-xs font-medium text-text-dim hover-green">
          Открыть все задачи →
        </Link>
      </div>
    </Card>
  )
}

// ─── Async-секции (для Suspense streaming) ───────────────────────────────────

type DirectorStatsRow = {
  projects_count: number
  employees_count: number
  direct_task_counts: Record<string, number>
}

async function DirectorStats() {
  const supabase = await createClient()
  // Активные = только status='active' (enum: active|on_hold|completed|cancelled, нет archived).
  // Все 3 счётчика тянем одной RPC — миграция 044, экономит 2 RTT к Supabase.
  const { data } = await supabase.rpc('get_director_dashboard_stats').single()
  const stats = data as DirectorStatsRow | null
  const projectsCount  = stats?.projects_count  ?? 0
  const employeesCount = stats?.employees_count ?? 0
  const taskCounts     = stats?.direct_task_counts ?? {}

  const totalTasks = Object.values(taskCounts).reduce((a, b) => a + b, 0)
  const reviewCount = taskCounts['review'] ?? 0

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
        <StatCard icon={<FolderOpen size={18} />}     label="Активных проектов" value={projectsCount}  href="/dashboard/projects"  />
        <StatCard icon={<Users size={18} />}           label="Сотрудников"       value={employeesCount} href="/dashboard/employees" />
        <StatCard icon={<ClipboardList size={18} />}   label="Поручений всего"   value={totalTasks}          href="/dashboard/assign/all"
          accent={reviewCount > 0} />
      </div>
      {reviewCount > 0 && (
        <div className="mb-5">
          <Alert tone="warn" href="/dashboard/assign?status=review" actionLabel="Просмотреть">
            {reviewCount} {reviewCount === 1 ? 'поручение требует' : 'поручения требуют'} вашего внимания
          </Alert>
        </div>
      )}
    </>
  )
}

type ManagerStatsRow = {
  my_projects_count: number
  project_task_counts: Record<string, number>
  direct_task_counts: Record<string, number>
}

async function ManagerStats({ userId }: { userId: string }) {
  const supabase = await createClient()
  // 3 счётчика → одна RPC (миграция 044), список 5 поручений — отдельным запросом.
  // Итого 2 RTT вместо 4.
  const [{ data: statsRaw }, { data: myDirectTasks }] = await Promise.all([
    supabase.rpc('get_manager_dashboard_stats', { p_user_id: userId }).single(),
    supabase.from('direct_tasks')
      .select('id, title, priority, status, deadline, creator:profiles!direct_tasks_created_by_fkey(full_name)')
      .eq('assignee_id', userId)
      .neq('status', 'done')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(5),
  ])

  const stats = statsRaw as ManagerStatsRow | null
  const myProjectsCount   = stats?.my_projects_count   ?? 0
  const projectTaskCounts = stats?.project_task_counts ?? {}
  const directTaskCounts  = stats?.direct_task_counts  ?? {}

  const totalProjectTasks = Object.values(projectTaskCounts).reduce((a, b) => a + b, 0)
  const totalDirect = Object.values(directTaskCounts).reduce((a, b) => a + b, 0)

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
        <StatCard icon={<FolderOpen size={18} />}    label="Моих проектов"     value={myProjectsCount} href="/dashboard/projects" />
        <StatCard icon={<ClipboardList size={18} />} label="Задач в проектах"  value={totalProjectTasks}    href="/dashboard/tasks"
          accent={(projectTaskCounts['review'] ?? 0) > 0} />
        <StatCard icon={<Send size={18} />}          label="Поручений"         value={totalDirect}          href="/dashboard/assignments"
          accent={(directTaskCounts['review'] ?? 0) > 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
        <TaskStatusRow counts={projectTaskCounts} />

        <Card>
          <CardHeader icon={<Zap size={18} />} title="Быстрые действия" />
          <div className="p-4 md:p-6 grid grid-cols-1 gap-3">
            <QuickAction href="/dashboard/projects"
              icon={<FolderOpen size={18} />} iconColor="var(--color-green)"
              title="Мои проекты" subtitle="Проекты и этапы" />
            <QuickAction href="/dashboard/tasks"
              icon={<ClipboardList size={18} />} iconColor="var(--color-info)"
              title="Задачи в проектах" subtitle="Назначенные мне в проектах" />
          </div>
        </Card>

        <AssignedTasksCard tasks={(myDirectTasks ?? []) as unknown as Parameters<typeof AssignedTasksCard>[0]['tasks']} />
      </div>
    </>
  )
}

type EmployeeStatsRow = {
  project_task_counts: Record<string, number>
  overdue_direct: number
  overdue_project: number
}

async function EmployeeStats({ userId }: { userId: string }) {
  const supabase = await createClient()
  // Счётчики задач + просрочки → одна RPC (миграция 044), список 5 поручений — отдельным.
  // Итого 2 RTT вместо 3.
  const [{ data: statsRaw }, { data: myDirectTasks }] = await Promise.all([
    supabase.rpc('get_employee_dashboard_stats', { p_user_id: userId }).single(),
    supabase.from('direct_tasks')
      .select('id, title, priority, status, deadline, creator:profiles!direct_tasks_created_by_fkey(full_name)')
      .eq('assignee_id', userId)
      .neq('status', 'done')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(5),
  ])

  const stats = statsRaw as EmployeeStatsRow | null
  const projectTaskCounts = stats?.project_task_counts ?? {}
  const overdue = {
    direct:  stats?.overdue_direct  ?? 0,
    project: stats?.overdue_project ?? 0,
  }
  const totalProjectTasks = Object.values(projectTaskCounts).reduce((a, b) => a + b, 0)
  const totalOverdue = overdue.direct + overdue.project

  return (
    <>
      {totalOverdue > 0 && (
        <div className="mb-5">
          <Alert tone="danger" icon={<AlertTriangle size={16} />} href={overdue.direct > 0 ? '/dashboard/assignments' : '/dashboard/tasks'} actionLabel="Открыть">
            Просрочено: {overdue.direct > 0 && `${overdue.direct} ${overdue.direct === 1 ? 'поручение' : 'поручений'}`}
            {overdue.direct > 0 && overdue.project > 0 && ', '}
            {overdue.project > 0 && `${overdue.project} ${overdue.project === 1 ? 'задача' : 'задач'}`}
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
        <TaskStatusRow counts={projectTaskCounts} />

        <Card>
          <CardHeader icon={<Zap size={18} />} title="Задачи в проектах" />
          <div className="p-4 md:p-6 flex flex-col gap-3">
            <QuickAction href="/dashboard/tasks"
              icon={<ClipboardList size={18} />} iconColor="var(--color-green)"
              title="Все задачи"
              subtitle={`${totalProjectTasks} задач всего`} />
            {(projectTaskCounts['in_progress'] ?? 0) > 0 && (
              <Link
                href="/dashboard/tasks"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover-surface"
                style={{
                  borderWidth: 1, borderStyle: 'solid',
                  borderColor: 'color-mix(in oklab, var(--color-info) 25%, transparent)',
                  background:  'color-mix(in oklab, var(--color-info) 5%, transparent)',
                }}
              >
                <Zap size={18} className="text-info" />
                <div>
                  <p className="text-sm font-semibold text-text">В работе сейчас</p>
                  <p className="text-xs text-text-dim">
                    {projectTaskCounts['in_progress']} {projectTaskCounts['in_progress'] === 1 ? 'задача' : 'задачи'}
                  </p>
                </div>
                <span className="ml-auto text-text-dim">→</span>
              </Link>
            )}
          </div>
        </Card>

        <AssignedTasksCard tasks={(myDirectTasks ?? []) as unknown as Parameters<typeof AssignedTasksCard>[0]['tasks']} />
      </div>
    </>
  )
}

// ─── Главная страница ────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const hour = currentHourOral()
  const greeting =
    hour >= 5  && hour < 12 ? 'Доброе утро'
    : hour >= 12 && hour < 18 ? 'Добрый день'
    : hour >= 18 && hour < 23 ? 'Добрый вечер'
    : 'Доброй ночи'
  const firstName = getFirstName(profile.full_name)

  return (
    <div>
      {/* Хедер — мгновенно, данные есть */}
      <GreetingHeader greeting={greeting} firstName={firstName} />

      {/* Сотрудник: CTA «Подать дейли» — выше всех */}
      {profile.role === 'employee' && (
        <div className="mb-5">
          <Suspense fallback={<CtaSkeleton />}>
            <DailyCta userId={profile.id} />
          </Suspense>
        </div>
      )}

      {/* Опросы — показываются всем ролям, у кого есть неотвеченные */}
      <div className="mb-5 empty:hidden">
        <Suspense fallback={null}>
          <PollsCta userId={profile.id} />
        </Suspense>
      </div>

      {/* Stats и алерты — стримятся отдельно. Admin видит director-view. */}
      {hasDirectorAccess(profile.role) && (
        <Suspense fallback={<StatsSkeleton n={3} />}>
          <DirectorStats />
        </Suspense>
      )}

      {profile.role === 'manager' && (
        <Suspense fallback={<StatsSkeleton n={2} />}>
          <ManagerStats userId={profile.id} />
        </Suspense>
      )}

      {profile.role === 'employee' && (
        <Suspense fallback={<StatsSkeleton n={2} />}>
          <EmployeeStats userId={profile.id} />
        </Suspense>
      )}

      {/* Общие блоки для всех ролей. Стримятся независимо.
          xl:grid-cols-3 — на широких мониторах не оставляем пустое пространство (V7). */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2 xl:grid-cols-3 mt-4">
        {hasDirectorAccess(profile.role) && (
          <>
            <Suspense fallback={<CardListSkeleton title="w-44" rows={4} />}>
              <SilentEmployeesCard />
            </Suspense>
            <Suspense fallback={<CardListSkeleton title="w-48" rows={4} />}>
              <RecentActivityCard />
            </Suspense>
            <Card>
              <CardHeader icon={<Zap size={18} />} title="Быстрые действия" />
              <div className="p-4 md:p-6 grid grid-cols-1 gap-3">
                <QuickAction href="/dashboard/projects/new"
                  icon={<FolderOpen size={18} />} iconColor="var(--color-green)"
                  title="Новый проект" subtitle="Создать проект с этапами" />
                <QuickAction href="/dashboard/assign/new"
                  icon={<ClipboardList size={18} />} iconColor="var(--color-info)"
                  title="Поручить задание" subtitle="Назначить задачу сотруднику" />
                <QuickAction href="/dashboard/employees"
                  icon={<Users size={18} />} iconColor="var(--color-purple)"
                  title="Сотрудники" subtitle="Управление командой" />
              </div>
            </Card>
          </>
        )}

        <Suspense fallback={<CardListSkeleton title="w-40" rows={3} />}>
          <EventsCard />
        </Suspense>
        <Suspense fallback={<CardListSkeleton title="w-32" rows={3} />}>
          <BirthdaysCard />
        </Suspense>
      </div>
    </div>
  )
}

// Подавляем неиспользуемые импорты, которые могут понадобиться будущим секциям.
void todayOral
