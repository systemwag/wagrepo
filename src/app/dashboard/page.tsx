import { createClient, getProfile, getSession } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const [supabase, profile, session] = await Promise.all([
    createClient(),
    getProfile(),
    getSession(),
  ])

  const userId = session!.user.id
  const today = new Date().toISOString().split('T')[0]

  const [
    { count: projectsCount },
    { count: tasksCount },
    { count: overdueCount },
    { data: recentProjects },
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assignee_id', userId).neq('status', 'done'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).lt('deadline', today).neq('status', 'done'),
    supabase.from('projects').select('id, name, status, deadline, client_name').order('updated_at', { ascending: false }).limit(5),
  ])

  const statusLabel: Record<string, string> = {
    active: 'Активный',
    on_hold: 'На паузе',
    completed: 'Завершён',
    cancelled: 'Отменён',
  }

  const statusStyle: Record<string, React.CSSProperties> = {
    active: { background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' },
    on_hold: { background: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.2)' },
    completed: { background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' },
    cancelled: { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' },
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
          Добро пожаловать, {profile?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Активных проектов" value={projectsCount ?? 0} accent="green" />
        <StatCard label="Моих задач в работе" value={tasksCount ?? 0} accent="blue" />
        <StatCard label="Просроченных задач" value={overdueCount ?? 0} accent="red" />
      </div>

      {/* Последние проекты */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-medium" style={{ color: 'var(--text)' }}>Последние проекты</h2>
          <a href="/dashboard/projects" className="text-sm transition-colors" style={{ color: 'var(--green)' }}>
            Все проекты →
          </a>
        </div>

        {recentProjects && recentProjects.length > 0 ? (
          <div>
            {recentProjects.map((project, i) => (
              <a
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="flex items-center justify-between px-6 py-4 transition-colors row-hover"
                style={{
                  borderBottom: i < recentProjects.length - 1 ? '1px solid var(--border)' : undefined,
                }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{project.name}</p>
                  {project.client_name && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{project.client_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {project.deadline && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      до {new Date(project.deadline).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={statusStyle[project.status]}>
                    {statusLabel[project.status]}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Проектов пока нет
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: 'green' | 'blue' | 'red' }) {
  const accentStyle: Record<string, { color: string; bg: string }> = {
    green: { color: 'var(--green)', bg: 'var(--green-glow)' },
    blue: { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
    red: { color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
  }
  const a = accentStyle[accent]

  return (
    <div className="card p-5">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-3xl font-semibold mt-2" style={{ color: a.color }}>{value}</p>
    </div>
  )
}
