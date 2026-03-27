import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Cake, CalendarDays, FolderOpen, Users, ClipboardList,
  AlertTriangle, Activity, CheckCircle, Clock, Eye, Zap, Send,
} from 'lucide-react'
import { todayOral, todayStringOral, currentHourOral } from '@/lib/utils/date'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function birthdayDaysLeft(birthDate: string): number {
  const today = new Date()
  const bd    = new Date(birthDate)
  const next  = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

const roleLabel: Record<string, string> = {
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}

const IMPORTANCE_COLOR: Record<string, string> = {
  low: '#60a5fa', medium: '#fbbf24', high: '#fb923c', critical: '#f87171',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  todo:        { label: 'К выполнению', color: 'var(--text-muted)', bg: 'var(--surface-2)',      border: 'var(--border-2)',         icon: <Clock size={14} /> },
  in_progress: { label: 'В работе',     color: '#60a5fa',           bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)',   icon: <Zap size={14} /> },
  review:      { label: 'На проверке',  color: '#f59e0b',           bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',   icon: <Eye size={14} /> },
  done:        { label: 'Выполнено',    color: 'var(--green)',       bg: 'var(--green-glow)',     border: 'rgba(34,197,94,0.3)',     icon: <CheckCircle size={14} /> },
}

// ─── Общие компоненты ─────────────────────────────────────────────────────────

function PageHeader({ profile, greeting, firstName }: { profile: { full_name: string; role: string }; greeting: string; firstName: string }) {
  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="WAG" style={{ height: 'clamp(60px, 18vw, 180px)', width: 'auto' }} />
          <p className="text-xs md:text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="text-right text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          <p style={{ color: 'var(--text)' }} className="font-medium">{profile.full_name.split(' ')[0]}</p>
          <p>{roleLabel[profile.role]}</p>
        </div>
      </div>
      <div className="mb-6">
        <h1 className="font-bold" style={{ color: 'var(--text)', fontSize: 'clamp(1.5rem, 6vw, 2.4rem)', lineHeight: 1.15 }}>
          {greeting}, <span style={{ color: 'var(--green)' }}>{firstName}</span>!
        </h1>
      </div>
    </>
  )
}

function StatCard({ icon, label, value, href, accent }: {
  icon: React.ReactNode; label: string; value: number | string; href?: string; accent?: boolean
}) {
  const content = (
    <div
      className="card flex items-center gap-4 px-4 py-4 md:px-5"
      style={accent ? { borderColor: 'rgba(34,197,94,0.3)' } : undefined}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: accent ? 'var(--green-glow)' : 'var(--surface-2)', color: accent ? 'var(--green)' : 'var(--text-muted)' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none" style={{ color: accent ? 'var(--green)' : 'var(--text)' }}>{value}</p>
        <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-dim)' }}>{label}</p>
      </div>
    </div>
  )
  if (href) return <Link href={href}>{content}</Link>
  return content
}

function EventsCard({ events, todayStr }: {
  events: { id: string; title: string; date: string; start_time: string | null; importance: string; location: string | null }[]
  todayStr: string
}) {
  const todayTs = todayOral().getTime()
  return (
    <div className="card">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <CalendarDays size={18} style={{ color: 'var(--green)' }} />
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Ближайшие мероприятия</h2>
        {events.length > 0 && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' }}>
            {events.length}
          </span>
        )}
        <Link href="/dashboard/events" className="text-xs ml-2 flex-shrink-0 hover-green"
          style={{ color: 'var(--text-dim)' }}>
          Все →
        </Link>
      </div>
      {events.length > 0 ? (
        <div>
          {events.map((ev, i) => {
            const evDate   = new Date(ev.date + 'T00:00:00')
            const isToday  = ev.date === todayStr
            const daysDiff = Math.round((evDate.getTime() - todayTs) / 86400000)
            const color    = IMPORTANCE_COLOR[ev.importance] ?? '#fbbf24'
            return (
              <Link key={ev.id} href="/dashboard/events"
                className="flex items-center gap-3 px-4 py-3 md:px-6 row-hover"
                style={{ borderBottom: i < events.length - 1 ? '1px solid var(--border)' : undefined }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{ev.title}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    {evDate.toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })}
                    {ev.start_time && ` · ${ev.start_time.slice(0, 5)}`}
                    {ev.location   && ` · ${ev.location}`}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {isToday ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                      Сегодня
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      через {daysDiff} {daysDiff === 1 ? 'день' : daysDiff < 5 ? 'дня' : 'дней'}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="px-4 py-8 flex flex-col items-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <CalendarDays size={40} style={{ opacity: 0.2 }} />
          <p className="text-sm">Мероприятий в ближайшие 14 дней нет</p>
        </div>
      )}
    </div>
  )
}

function BirthdaysCard({ birthdays }: {
  birthdays: { id: string; full_name: string; role: string; position: string | null; daysLeft: number }[]
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Cake size={18} style={{ color: 'var(--green)' }} />
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Дни рождения</h2>
        {birthdays.length > 0 && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' }}>
            {birthdays.length}
          </span>
        )}
      </div>
      {birthdays.length > 0 ? (
        <div>
          {birthdays.map((person, i) => {
            const isToday = person.daysLeft === 0
            const isSoon  = person.daysLeft <= 3
            return (
              <div key={person.id} className="flex items-center gap-3 px-4 py-3 md:px-6"
                style={{
                  borderBottom: i < birthdays.length - 1 ? '1px solid var(--border)' : undefined,
                  background: isToday ? 'var(--green-glow)' : undefined,
                }}>
                <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold"
                  style={isToday
                    ? { background: 'var(--green)', color: '#0a0f0a' }
                    : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {person.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: isToday ? 'var(--green)' : 'var(--text)' }}>
                    {person.full_name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
                    {person.position ?? roleLabel[person.role]}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {isToday ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: 'var(--green)', color: '#0a0f0a' }}>
                      Сегодня 🎂
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-lg"
                      style={isSoon
                        ? { background: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.2)' }
                        : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      через {person.daysLeft} {person.daysLeft === 1 ? 'день' : person.daysLeft < 5 ? 'дня' : 'дней'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="px-4 py-8 flex flex-col items-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <Cake size={40} style={{ opacity: 0.2 }} />
          <p className="text-sm">В ближайшие 30 дней дней рождения нет</p>
        </div>
      )}
    </div>
  )
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критичный',
}
const PRIORITY_COLOR: Record<string, string> = {
  low: 'var(--text-muted)', medium: '#60a5fa', high: '#fb923c', critical: '#f87171',
}

function AssignedTasksCard({ tasks }: {
  tasks: { id: string; title: string; priority: string; status: string; deadline: string | null; creator: { full_name: string } | null }[]
}) {
  if (tasks.length === 0) return (
    <div className="card">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Send size={18} style={{ color: '#f59e0b' }} />
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Поручения</h2>
      </div>
      <div className="px-4 py-8 flex flex-col items-center gap-3" style={{ color: 'var(--text-muted)' }}>
        <Send size={40} style={{ opacity: 0.2 }} />
        <p className="text-sm">Поручений пока нет</p>
      </div>
    </div>
  )

  return (
    <div className="card">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Send size={18} style={{ color: '#f59e0b' }} />
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Поручения</h2>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
          {tasks.length}
        </span>
      </div>
      <div>
        {tasks.map((task, i) => {
          const sc  = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo
          const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'
          return (
            <div key={task.id} className="px-4 py-3 md:px-6"
              style={{ borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : undefined }}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{task.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-xs font-semibold" style={{ color: PRIORITY_COLOR[task.priority] }}>
                      {PRIORITY_LABEL[task.priority] ?? task.priority}
                    </span>
                    {task.deadline && (
                      <span className="text-xs" style={{ color: isOverdue ? '#f87171' : 'var(--text-dim)' }}>
                        {isOverdue ? '⚠ ' : ''}{new Date(task.deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {task.creator && (
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                        от {task.creator.full_name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-lg flex-shrink-0"
                  style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                  {sc.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-3 md:px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <Link href="/dashboard/tasks" className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
          Открыть все задачи →
        </Link>
      </div>
    </div>
  )
}

function TaskStatusRow({ counts }: { counts: Record<string, number> }) {
  const statuses = ['todo', 'in_progress', 'review', 'done'] as const
  return (
    <div className="card">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <ClipboardList size={18} style={{ color: 'var(--green)' }} />
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Работа по проекту</h2>
        <Link href="/dashboard/tasks" className="ml-auto text-xs font-medium hover-green transition-colors"
          style={{ color: 'var(--text-dim)' }}>
          Открыть →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0"
        style={{ borderColor: 'var(--border)' }}>
        {statuses.map(s => {
          const cfg = STATUS_CONFIG[s]
          const count = counts[s] ?? 0
          return (
            <div key={s} className="flex flex-col items-center justify-center py-5 gap-1.5">
              <div className="flex items-center gap-1.5" style={{ color: cfg.color }}>
                {cfg.icon}
                <span className="text-2xl font-bold leading-none">{count}</span>
              </div>
              <p className="text-xs text-center px-1" style={{ color: 'var(--text-dim)' }}>{cfg.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Страница ─────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')

  const hour      = currentHourOral()
  const greeting  = hour >= 5 && hour < 12 ? 'Доброе утро' : hour >= 12 && hour < 18 ? 'Добрый день' : hour >= 18 && hour < 23 ? 'Добрый вечер' : 'Доброй ночи'
  const firstName = profile.full_name.split(' ')[0]

  const todayStr   = todayStringOral()
  const plus14     = new Date(todayStr); plus14.setDate(plus14.getDate() + 14)
  const plus14Str  = plus14.toISOString().split('T')[0]

  // ── Общие данные для всех ролей ──
  const [{ data: eventsData }, { data: allProfiles }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, date, start_time, importance, location')
      .gte('date', todayStr)
      .lte('date', plus14Str)
      .order('date').order('start_time', { nullsFirst: true })
      .limit(6),
    supabase
      .from('profiles')
      .select('id, full_name, role, position, birth_date')
      .not('birth_date', 'is', null)
      .eq('is_active', true),
  ])

  const events = eventsData ?? []
  const birthdays = (allProfiles ?? [])
    .map(p => ({ ...p, daysLeft: birthdayDaysLeft(p.birth_date!) }))
    .filter(p => p.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // ── Директор ──────────────────────────────────────────────────────────────
  if (profile.role === 'director') {
    const [
      { count: projectsCount },
      { count: employeesCount },
      { data: taskRows },
      { data: activityRows },
    ] = await Promise.all([
      supabase.from('projects').select('*', { count: 'exact', head: true }).neq('status', 'archived'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('tasks').select('status').eq('source', 'direct'),
      supabase
        .from('activity_log')
        .select('id, action, meta, created_at, actor:profiles!activity_log_actor_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const taskCounts: Record<string, number> = {}
    for (const t of taskRows ?? []) taskCounts[t.status] = (taskCounts[t.status] ?? 0) + 1
    const totalTasks = Object.values(taskCounts).reduce((a, b) => a + b, 0)

    const ACTION_VERBS: Record<string, string> = {
      'project.created':    'создал проект',
      'task.created':       'создал задачу',
      'task.updated':       'обновил задачу',
      'task.deleted':       'удалил задачу',
      'task.status_changed':'изменил статус задачи',
      'task.feedback':      'отчитался по задаче',
      'stage.created':      'создал этап',
      'stage.status_changed':'изменил статус этапа',
      'stage.review_changed':'проверил этап',
      'event.created':      'создал мероприятие',
      'event.updated':      'обновил мероприятие',
      'event.deleted':      'удалил мероприятие',
    }

    return (
      <div>
        <PageHeader profile={profile} greeting={greeting} firstName={firstName} />

        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
          <StatCard icon={<FolderOpen size={18} />}    label="Активных проектов"  value={projectsCount ?? 0}  href="/dashboard/projects" />
          <StatCard icon={<Users size={18} />}          label="Сотрудников"        value={employeesCount ?? 0} href="/dashboard/employees" />
          <StatCard icon={<ClipboardList size={18} />}  label="Поручений всего"    value={totalTasks}          href="/dashboard/assign"
            accent={(taskCounts['review'] ?? 0) > 0} />
        </div>

        {/* Если есть задачи на проверку — предупреждение */}
        {(taskCounts['review'] ?? 0) > 0 && (
          <Link href="/dashboard/assign?status=review">
            <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <p className="text-sm font-medium" style={{ color: '#f59e0b' }}>
                {taskCounts['review']} {taskCounts['review'] === 1 ? 'поручение требует' : 'поручения требуют'} вашего внимания
              </p>
              <span className="ml-auto text-xs" style={{ color: '#f59e0b' }}>Просмотреть →</span>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
          {/* Последняя активность */}
          <div className="card col-span-full md:col-span-1">
            <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <Activity size={18} style={{ color: 'var(--green)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Последняя активность</h2>
              <Link href="/dashboard/activity" className="ml-auto text-xs font-medium transition-colors"
                style={{ color: 'var(--text-dim)' }}>
                Все →
              </Link>
            </div>
            {(activityRows ?? []).length > 0 ? (
              <div>
                {activityRows!.map((row, i) => {
                  type Actor = { full_name: string }
                  const actor = Array.isArray(row.actor) ? (row.actor[0] as Actor) : (row.actor as Actor | null)
                  const meta  = (row.meta ?? {}) as Record<string, string>
                  const verb  = ACTION_VERBS[row.action] ?? row.action
                  const title = meta.name ?? meta.title ?? meta.stageName ?? ''
                  return (
                    <div key={row.id} className="flex items-start gap-3 px-4 py-3 md:px-6"
                      style={{ borderBottom: i < activityRows!.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                        {actor?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug" style={{ color: 'var(--text)' }}>
                          <span className="font-medium">{actor?.full_name?.split(' ')[0] ?? '—'}</span>
                          {' '}<span style={{ color: 'var(--text-muted)' }}>{verb}</span>
                          {title && <> <span className="font-medium">«{title}»</span></>}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                          {new Date(row.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-4 py-8 flex flex-col items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                <Activity size={40} style={{ opacity: 0.2 }} />
                <p className="text-sm">Активности пока нет</p>
              </div>
            )}
          </div>

          {/* Быстрые действия */}
          <div className="card col-span-full md:col-span-1">
            <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <Zap size={18} style={{ color: 'var(--green)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Быстрые действия</h2>
            </div>
            <div className="p-4 md:p-6 grid grid-cols-1 gap-3">
              <Link href="/dashboard/projects/new"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover-surface"
                style={{ border: '1px solid var(--border)' }}>
                <FolderOpen size={18} style={{ color: 'var(--green)' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Новый проект</p>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Создать проект с этапами</p>
                </div>
                <span className="ml-auto" style={{ color: 'var(--text-dim)' }}>→</span>
              </Link>
              <Link href="/dashboard/assign/new"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover-surface"
                style={{ border: '1px solid var(--border)' }}>
                <ClipboardList size={18} style={{ color: '#60a5fa' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Поручить задание</p>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Назначить задачу сотруднику</p>
                </div>
                <span className="ml-auto" style={{ color: 'var(--text-dim)' }}>→</span>
              </Link>
              <Link href="/dashboard/employees"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover-surface"
                style={{ border: '1px solid var(--border)' }}>
                <Users size={18} style={{ color: '#a78bfa' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Сотрудники</p>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Управление командой</p>
                </div>
                <span className="ml-auto" style={{ color: 'var(--text-dim)' }}>→</span>
              </Link>
            </div>
          </div>

          <EventsCard   events={events}    todayStr={todayStr} />
          <BirthdaysCard birthdays={birthdays} />
        </div>
      </div>
    )
  }

  // ── Менеджер ──────────────────────────────────────────────────────────────
  if (profile.role === 'manager') {
    const [{ count: myProjectsCount }, { data: myTaskRows }, { data: myDirectTasks }] = await Promise.all([
      supabase.from('projects').select('*', { count: 'exact', head: true })
        .eq('manager_id', profile.id).neq('status', 'archived'),
      supabase.from('tasks').select('status').eq('assignee_id', profile.id),
      supabase.from('tasks')
        .select('id, title, priority, status, deadline, creator:profiles!tasks_created_by_fkey(full_name)')
        .eq('assignee_id', profile.id)
        .is('project_id', null)
        .neq('status', 'done')
        .order('deadline', { ascending: true, nullsFirst: false })
        .limit(5),
    ])

    const taskCounts: Record<string, number> = {}
    for (const t of myTaskRows ?? []) taskCounts[t.status] = (taskCounts[t.status] ?? 0) + 1

    return (
      <div>
        <PageHeader profile={profile} greeting={greeting} firstName={firstName} />

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
          <StatCard icon={<FolderOpen size={18} />}   label="Моих проектов"     value={myProjectsCount ?? 0} href="/dashboard/projects" />
          <StatCard icon={<ClipboardList size={18} />} label="Моих задач всего"  value={Object.values(taskCounts).reduce((a, b) => a + b, 0)} href="/dashboard/tasks"
            accent={(taskCounts['review'] ?? 0) > 0} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
          <TaskStatusRow counts={taskCounts} />

          {/* Быстрые действия */}
          <div className="card">
            <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <Zap size={18} style={{ color: 'var(--green)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Быстрые действия</h2>
            </div>
            <div className="p-4 md:p-6 grid grid-cols-1 gap-3">
              <Link href="/dashboard/projects"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover-surface"
                style={{ border: '1px solid var(--border)' }}>
                <FolderOpen size={18} style={{ color: 'var(--green)' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Мои проекты</p>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Проекты и этапы</p>
                </div>
                <span className="ml-auto" style={{ color: 'var(--text-dim)' }}>→</span>
              </Link>
              <Link href="/dashboard/tasks"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover-surface"
                style={{ border: '1px solid var(--border)' }}>
                <ClipboardList size={18} style={{ color: '#60a5fa' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Работа по проекту</p>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Задачи назначенные мне</p>
                </div>
                <span className="ml-auto" style={{ color: 'var(--text-dim)' }}>→</span>
              </Link>
            </div>
          </div>

          <AssignedTasksCard tasks={(myDirectTasks ?? []) as unknown as Parameters<typeof AssignedTasksCard>[0]['tasks']} />
          <EventsCard   events={events}    todayStr={todayStr} />
          <BirthdaysCard birthdays={birthdays} />
        </div>
      </div>
    )
  }

  // ── Сотрудник ─────────────────────────────────────────────────────────────
  const [{ data: myTaskRows }, { data: myDirectTasks }] = await Promise.all([
    supabase.from('tasks').select('status, deadline').eq('assignee_id', profile.id),
    supabase.from('tasks')
      .select('id, title, priority, status, deadline, creator:profiles!tasks_created_by_fkey(full_name)')
      .eq('assignee_id', profile.id)
      .is('project_id', null)
      .neq('status', 'done')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(5),
  ])

  const taskCounts: Record<string, number> = {}
  for (const t of myTaskRows ?? []) taskCounts[t.status] = (taskCounts[t.status] ?? 0) + 1

  const today = todayOral()
  const overdueCount = (myTaskRows ?? []).filter(t =>
    t.deadline && new Date(t.deadline) < today && t.status !== 'done'
  ).length

  return (
    <div>
      <PageHeader profile={profile} greeting={greeting} firstName={firstName} />

      {/* Предупреждение о просрочке */}
      {overdueCount > 0 && (
        <Link href="/dashboard/tasks">
          <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertTriangle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
            <p className="text-sm font-medium" style={{ color: '#f87171' }}>
              {overdueCount} {overdueCount === 1 ? 'задача просрочена' : overdueCount < 5 ? 'задачи просрочены' : 'задач просрочено'}
            </p>
            <span className="ml-auto text-xs" style={{ color: '#f87171' }}>Открыть →</span>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
        <TaskStatusRow counts={taskCounts} />

        {/* Быстрые действия */}
        <div className="card">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <Zap size={18} style={{ color: 'var(--green)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Работа по проекту</h2>
          </div>
          <div className="p-4 md:p-6 flex flex-col gap-3">
            <Link href="/dashboard/tasks"
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover-surface"
              style={{ border: '1px solid var(--border)' }}>
              <ClipboardList size={18} style={{ color: 'var(--green)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Все задачи</p>
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {Object.values(taskCounts).reduce((a, b) => a + b, 0)} задач всего
                </p>
              </div>
              <span className="ml-auto" style={{ color: 'var(--text-dim)' }}>→</span>
            </Link>
            {(taskCounts['in_progress'] ?? 0) > 0 && (
              <Link href="/dashboard/tasks"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover-surface"
                style={{ border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.05)' }}>
                <Zap size={18} style={{ color: '#60a5fa' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>В работе сейчас</p>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {taskCounts['in_progress']} {taskCounts['in_progress'] === 1 ? 'задача' : 'задачи'}
                  </p>
                </div>
                <span className="ml-auto" style={{ color: 'var(--text-dim)' }}>→</span>
              </Link>
            )}
          </div>
        </div>

        <AssignedTasksCard tasks={(myDirectTasks ?? []) as unknown as Parameters<typeof AssignedTasksCard>[0]['tasks']} />
        <EventsCard   events={events}    todayStr={todayStr} />
        <BirthdaysCard birthdays={birthdays} />
      </div>
    </div>
  )
}
