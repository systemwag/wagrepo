import { createClient, getProfile } from '@/lib/supabase/server'
import Link from 'next/link'
import NewProjectButton from './NewProjectButton'

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

export default async function ProjectsPage() {
  const [supabase, profile] = await Promise.all([
    createClient(),
    getProfile(),
  ])

  const isDirector = profile?.role === 'director'
  const isManager  = profile?.role === 'manager'
  const userId     = profile?.id

  const query = supabase
    .from('projects')
    .select(`
      id, name, status, deadline, client_name, contract_number, budget,
      manager:profiles!projects_manager_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })

  // Менеджер видит только свои проекты
  if (isManager && userId) query.eq('manager_id', userId)

  const { data: projects } = await query

  const canCreate = isDirector || isManager

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Проекты</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{projects?.length ?? 0} проектов</p>
        </div>
        {canCreate && <NewProjectButton />}
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {projects.map(project => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="card px-6 py-5 flex items-center justify-between transition-colors group hover-border"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium transition-colors truncate" style={{ color: 'var(--text)' }}>
                    {project.name}
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0" style={statusStyle[project.status]}>
                    {statusLabel[project.status]}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5">
                  {project.client_name && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{project.client_name}</span>
                  )}
                  {project.contract_number && (
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>№ {project.contract_number}</span>
                  )}
                  {(project.manager as unknown as { full_name: string }[] | null)?.[0]?.full_name && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Менеджер: {(project.manager as unknown as { full_name: string }[])[0].full_name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6 flex-shrink-0 ml-6">
                {project.budget && (
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Бюджет</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {Number(project.budget).toLocaleString('ru-RU')} ₸
                    </p>
                  </div>
                )}
                {project.deadline && (
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Дедлайн</p>
                    <p className="text-sm font-medium" style={{
                      color: new Date(project.deadline) < new Date() && project.status === 'active'
                        ? '#f87171'
                        : 'var(--text)',
                    }}>
                      {new Date(project.deadline).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                )}
                <svg className="w-5 h-5 transition-colors" style={{ color: 'var(--text-dim)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card py-20 text-center">
          <p style={{ color: 'var(--text-muted)' }}>Проектов пока нет</p>
          {canCreate && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Нажмите «Новый проект», чтобы начать</p>
          )}
        </div>
      )}
    </div>
  )
}
