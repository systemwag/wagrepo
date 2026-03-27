import { createClient, getProfile } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { DesignStage } from '@/lib/constants/design-stages'
import KanbanBoard from './KanbanBoard'
import ProjectPipelineView from '@/components/planning/ProjectPipelineView'
import StageProgressBar from '@/components/planning/StageProgressBar'
import ProjectTabsClient from './ProjectTabsClient'
import DeleteProjectButton from './DeleteProjectButton'

const statusLabel: Record<string, string> = {
  active:    'Активный',
  on_hold:   'На паузе',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

const statusStyle: Record<string, React.CSSProperties> = {
  active:    { background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' },
  on_hold:   { background: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.2)' },
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
      .select(`
        *,
        assignee:profiles!project_stages_assignee_id_fkey(id, full_name),
        checklist_items:stage_checklist_items(*, checker:profiles!completed_by(full_name)),
        stage_documents:documents!stage_id(*)
      `)
      .eq('project_id', id)
      .order('order_index'),
    supabase
      .from('tasks')
      .select(`*, assignee:profiles!tasks_assignee_id_fkey(full_name), checklist_item:stage_checklist_items!checklist_item_id(id, label)`)
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
  const userRole  = profile?.role ?? 'employee'

  // Нормализуем данные
  const normalizedStages = (stages ?? []).map(s => ({
    ...s,
    checklist_items: Array.isArray(s.checklist_items)
      ? s.checklist_items.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
      : [],
    stage_documents: Array.isArray(s.stage_documents)
      ? s.stage_documents.sort((a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at))
      : [],
    status: s.status ?? 'pending',
  }))

  return (
    <div className="h-full flex flex-col">
      {/* Шапка проекта */}
      <div className="mb-5">
        {/* Breadcrumb + кнопка удаления */}
        <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Link href="/dashboard/projects" className="transition-colors flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              Проекты
            </Link>
            <span style={{ color: 'var(--text-dim)' }}>/</span>
            <span className="truncate" style={{ color: 'var(--text-muted)' }}>{project.name}</span>
          </div>
          {profile?.role === 'director' && (
            <div className="flex-shrink-0">
              <DeleteProjectButton projectId={id} projectName={project.name} />
            </div>
          )}
        </div>

        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{project.name}</h1>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
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

        {/* Мета-инфо */}
        {(project.budget || project.deadline || (project.manager as { full_name?: string } | null)?.full_name) && (
          <div className="flex items-center gap-5 mt-3 flex-wrap">
            {project.budget && (
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Бюджет</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{Number(project.budget).toLocaleString('ru-RU')} ₸</p>
              </div>
            )}
            {project.deadline && (
              <div>
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
            {(project.manager as { full_name?: string } | null)?.full_name && (
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Менеджер</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {(project.manager as { full_name: string }).full_name}
                </p>
              </div>
            )}
          </div>
        )}

        {project.description && (
          <p className="text-sm mt-3 max-w-2xl" style={{ color: 'var(--text-muted)' }}>{project.description}</p>
        )}

        {/* Прогресс этапов */}
        {normalizedStages.length > 0 && (
          <div className="mt-4">
            <StageProgressBar stages={normalizedStages as DesignStage[]} />
          </div>
        )}
      </div>

      {/* Вкладки */}
      <ProjectTabsClient
        pipelineView={
          <ProjectPipelineView
            stages={normalizedStages as DesignStage[]}
            tasks={tasks ?? []}
            projectId={id}
            canManage={canManage}
            userRole={userRole}
            employees={employees ?? []}
          />
        }
        kanbanView={
          <KanbanBoard
            stages={normalizedStages as DesignStage[]}
            tasks={tasks ?? []}
            projectId={id}
            canManage={canManage}
            employees={employees ?? []}
            userRole={userRole}
          />
        }
      />
    </div>
  )
}
