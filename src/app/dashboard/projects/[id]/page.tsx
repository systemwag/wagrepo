import { createClient, getProfile } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import KanbanBoard from './KanbanBoard'

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

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase, profile] = await Promise.all([
    params,
    createClient(),
    getProfile(),
  ])

  const [
    { data: project },
    { data: stages },
    { data: tasks },
    { data: employees },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select(`
        *,
        manager:profiles!projects_manager_id_fkey(full_name),
        creator:profiles!projects_created_by_fkey(full_name)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('project_stages')
      .select('*, assignee:profiles!project_stages_assignee_id_fkey(id, full_name)')
      .eq('project_id', id)
      .order('order_index'),
    supabase
      .from('tasks')
      .select(`*, assignee:profiles!tasks_assignee_id_fkey(full_name)`)
      .eq('project_id', id)
      .order('created_at'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name'),
  ])

  if (!project) notFound()

  const canManage = profile?.role === 'director' || profile?.role === 'manager'

  return (
    <div className="h-full flex flex-col">
      {/* Шапка проекта */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <a href="/dashboard/projects" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>
                Проекты
              </a>
              <span style={{ color: 'var(--text-dim)' }}>/</span>
              <span className="text-sm truncate max-w-xs" style={{ color: 'var(--text-muted)' }}>{project.name}</span>
            </div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{project.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={statusStyle[project.status]}>
                {statusLabel[project.status]}
              </span>
              {project.client_name && (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{project.client_name}</span>
              )}
              {project.contract_number && (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>№ {project.contract_number}</span>
              )}
            </div>
          </div>

          {/* Мета-инфо */}
          <div className="flex items-center gap-6 flex-shrink-0">
            {project.budget && (
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Бюджет</p>
                <p className="font-medium" style={{ color: 'var(--text)' }}>{Number(project.budget).toLocaleString('ru-RU')} ₸</p>
              </div>
            )}
            {project.deadline && (
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Дедлайн</p>
                <p className="font-medium" style={{
                  color: new Date(project.deadline) < new Date() && project.status === 'active'
                    ? '#f87171'
                    : 'var(--text)',
                }}>
                  {new Date(project.deadline).toLocaleDateString('ru-RU')}
                </p>
              </div>
            )}
            {(project.manager as any)?.full_name && (
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Менеджер</p>
                <p className="font-medium" style={{ color: 'var(--text)' }}>{(project.manager as any).full_name}</p>
              </div>
            )}
          </div>
        </div>

        {project.description && (
          <p className="text-sm mt-3 max-w-2xl" style={{ color: 'var(--text-muted)' }}>{project.description}</p>
        )}
      </div>

      {/* Kanban */}
      <KanbanBoard
        stages={stages ?? []}
        tasks={tasks ?? []}
        projectId={id}
        canManage={canManage}
        employees={employees ?? []}
      />
    </div>
  )
}
