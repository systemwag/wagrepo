import { createClient, getProfile } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FolderOpen } from 'lucide-react'
import type { DesignStage } from '@/lib/constants/design-stages'
import ProjectTasksBoard from './ProjectTasksBoard'
import ProjectPipelineView from '@/components/planning/ProjectPipelineView'
import ProjectProgressView from '@/components/planning/ProjectProgressView'
import type { ProjectActivityEntry } from '@/lib/actions/activity'
import StageProgressBar from '@/components/planning/StageProgressBar'
import ProjectTabsClient from './ProjectTabsClient'
import DeleteProjectButton from './DeleteProjectButton'
import EditProjectButton from './EditProjectButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectStatusPill, type ProjectStatus } from '@/components/ui/StatusPill'
import { ProjectsEmptyState } from '@/components/projects/ProjectsEmptyState'
import { hasDirectorAccess, hasManagerAccess } from '@/lib/roles'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, supabase, profile] = await Promise.all([
    params,
    createClient(),
    getProfile(),
  ])

  const isEmployee = (profile?.role ?? 'employee') === 'employee'
  const canManageEarly = hasManagerAccess(profile?.role)

  // Для сотрудника параллельно с основными запросами тянем список видимых
  // этапов и задач (миграция 059). У менеджера/директора фильтр не применяем.
  const employeeViewPromise = isEmployee && profile
    ? supabase.rpc('get_employee_project_view', { p_project_id: id, p_user_id: profile.id })
    : Promise.resolve({ data: null as { visible_stage_ids: string[]; visible_task_ids: string[] }[] | null })

  // db.employees нужна только для pickers «Назначить ответственного» и
  // «Создать задачу» — у сотрудника этих кнопок нет, список не грузим.
  const employeesPromise = canManageEarly
    ? supabase
        .from('profiles')
        .select('id, full_name, role, position')
        .eq('is_active', true)
        .neq('role', 'admin')
        .order('full_name')
    : Promise.resolve({ data: [] as { id: string; full_name: string; role: string; position: string | null }[] })

  const [
    { data: project },
    { data: stages },
    { data: tasks },
    { data: employees },
    { data: activity },
    { data: employeeView },
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
        assignees:project_stage_assignees(profile:profiles!profile_id(id, full_name, role, position)),
        checklist_items:stage_checklist_items(
          *,
          checker:profiles!completed_by(full_name),
          starter:profiles!started_by(full_name),
          assignees:stage_checklist_item_assignees(
            created_at,
            profile:profiles!profile_id(id, full_name, role, position)
          )
        ),
        stage_documents:documents!stage_id(*)
      `)
      .eq('project_id', id)
      .order('order_index'),
    supabase
      .from('project_tasks')
      .select(`
        *,
        assignee:profiles!project_tasks_assignee_id_fkey(full_name),
        assignees:project_task_assignees(profile:profiles!profile_id(id, full_name, role, position)),
        checklist_item:stage_checklist_items!checklist_item_id(id, label)
      `)
      .eq('project_id', id)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true }),
    employeesPromise,
    supabase.rpc('get_project_activity', { p_project_id: id, p_limit: 50, p_offset: 0 }),
    employeeViewPromise,
  ])

  if (!project) notFound()

  const canManage = hasManagerAccess(profile?.role)
  const userRole  = profile?.role ?? 'employee'

  // RPC возвращает массив из одной строки; разворачиваем в Set'ы для быстрого .has().
  const employeeRow = Array.isArray(employeeView) ? employeeView[0] : null
  const visibleStageSet = isEmployee && employeeRow
    ? new Set<string>(employeeRow.visible_stage_ids ?? [])
    : null
  const visibleTaskSet = isEmployee && employeeRow
    ? new Set<string>(employeeRow.visible_task_ids ?? [])
    : null

  // Нормализуем данные
  type RawAssigneeRow = { profile: { id: string; full_name: string; role?: string | null; position?: string | null } | null }
  type RawChecklistAssigneeRow = RawAssigneeRow & { created_at?: string | null }

  function flattenAssignees(arr: unknown): { id: string; full_name: string; role?: string | null; position?: string | null }[] {
    if (!Array.isArray(arr)) return []
    return (arr as RawAssigneeRow[])
      .map(row => row?.profile)
      .filter((p): p is NonNullable<RawAssigneeRow['profile']> => Boolean(p))
  }

  // Для пункта чек-листа сохраняем created_at — это и есть assigned_at конкретного человека.
  function flattenChecklistAssignees(arr: unknown): {
    id: string; full_name: string; role?: string | null; position?: string | null; assigned_at?: string | null
  }[] {
    if (!Array.isArray(arr)) return []
    return (arr as RawChecklistAssigneeRow[])
      .map(row => row?.profile ? { ...row.profile, assigned_at: row.created_at ?? null } : null)
      .filter((p): p is { id: string; full_name: string; role?: string | null; position?: string | null; assigned_at: string | null } => Boolean(p))
  }

  type RawChecklistItem = {
    order_index: number
    assignees?: unknown
    [key: string]: unknown
  }

  const normalizedStages = (stages ?? []).map(s => ({
    ...s,
    checklist_items: Array.isArray(s.checklist_items)
      ? (s.checklist_items as RawChecklistItem[])
          .map(item => ({ ...item, assignees: flattenChecklistAssignees(item.assignees) }))
          .sort((a, b) => a.order_index - b.order_index)
      : [],
    stage_documents: Array.isArray(s.stage_documents)
      ? s.stage_documents.sort((a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at))
      : [],
    assignees: flattenAssignees(s.assignees),
    status: s.status ?? 'pending',
  }))

  const normalizedTasks = (tasks ?? []).map(t => ({
    ...t,
    assignees: flattenAssignees(t.assignees),
  }))

  // Полный список — для шапки/общего прогресс-бара. Под сотрудника отдельно
  // считаем отфильтрованный список — он попадёт во вкладки.
  const visibleStages = visibleStageSet
    ? normalizedStages.filter(s => visibleStageSet.has(s.id))
    : normalizedStages

  const visibleTasks = visibleTaskSet
    ? normalizedTasks.filter(t => visibleTaskSet.has(t.id))
    : normalizedTasks

  const employeeHasNothing = isEmployee && visibleStages.length === 0 && visibleTasks.length === 0

  const managerName = (project.manager as { full_name?: string } | null)?.full_name ?? null
  const isOverdue = !!(project.deadline && new Date(project.deadline) < new Date() && project.status === 'active')
  const formattedDeadline = project.deadline
    ? new Date(project.deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' })
    : null

  return (
    <div>
      <PageHeader
        icon={<FolderOpen size={18} />}
        iconTone={isOverdue ? 'danger' : 'green'}
        title={
          <span style={{ viewTransitionName: `project-title-${id}` } as React.CSSProperties}>
            {project.name}
          </span>
        }
        back={{ href: '/dashboard/projects', label: 'К проектам' }}
        action={
          canManage || hasDirectorAccess(profile?.role) ? (
            <div className="flex items-center gap-2">
              {canManage && profile && (
                <EditProjectButton
                  projectId={id}
                  currentUserId={profile.id}
                  initial={{
                    name:            project.name,
                    client_name:     project.client_name ?? null,
                    contract_number: project.contract_number ?? null,
                    start_date:      project.start_date ?? null,
                    deadline:        project.deadline ?? null,
                    description:     project.description ?? null,
                    manager_id:      project.manager_id ?? null,
                  }}
                  employees={employees ?? []}
                />
              )}
              {hasDirectorAccess(profile?.role) && (
                <DeleteProjectButton projectId={id} projectName={project.name} />
              )}
            </div>
          ) : null
        }
      />

      {/* Мета-блок проекта — статус, клиент, договор, дедлайн, менеджер, описание, прогресс. */}
      <div className="mb-6 -mt-2">
        <div className="flex items-center gap-3 flex-wrap">
          <ProjectStatusPill status={project.status as ProjectStatus} />
          {project.client_name && (
            <span className="text-sm text-text-muted">{project.client_name}</span>
          )}
          {project.contract_number && (
            <span className="text-sm text-text-muted num">№ {project.contract_number}</span>
          )}
        </div>

        {(formattedDeadline || managerName) && (
          <>
            <div className="flex md:hidden items-center gap-3 mt-3 flex-wrap text-sm">
              {formattedDeadline && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-text-dim text-xs uppercase tracking-wider">До</span>
                  <span className={`num font-medium ${isOverdue ? 'text-danger' : 'text-text'}`}>
                    {formattedDeadline}
                  </span>
                </span>
              )}
              {managerName && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-text-dim text-xs uppercase tracking-wider">Менеджер</span>
                  <span className="font-medium text-text">{managerName}</span>
                </span>
              )}
            </div>

            <div className="hidden md:flex items-center gap-5 mt-3 flex-wrap">
              {formattedDeadline && (
                <div>
                  <p className="text-xs text-text-muted">Дедлайн</p>
                  <p className={`text-sm font-medium num ${isOverdue ? 'text-danger' : 'text-text'}`}>
                    {formattedDeadline}
                  </p>
                </div>
              )}
              {managerName && (
                <div>
                  <p className="text-xs text-text-muted">Менеджер</p>
                  <p className="text-sm font-medium text-text">{managerName}</p>
                </div>
              )}
            </div>
          </>
        )}

        {project.description && (
          <p className="text-sm mt-3 max-w-2xl text-text-muted">{project.description}</p>
        )}

        {normalizedStages.length > 0 && (
          <div className="mt-4">
            <StageProgressBar stages={normalizedStages as DesignStage[]} />
          </div>
        )}
      </div>

      {/* Вкладки: вид прогресса (activity) — общий для всех, две другие
          подвкладки у сотрудника фильтруются по миграции 059. */}
      {employeeHasNothing ? (
        <ProjectsEmptyState kind="employee-no-tasks" projectName={project.name} />
      ) : (
        <ProjectTabsClient
          pipelineView={
            <ProjectPipelineView
              stages={visibleStages as DesignStage[]}
              tasks={visibleTasks ?? []}
              projectId={id}
              canManage={canManage}
              userRole={userRole}
              employees={employees ?? []}
              currentUserId={profile?.id}
            />
          }
          tasksView={
            <ProjectTasksBoard
              stages={visibleStages as DesignStage[]}
              tasks={visibleTasks ?? []}
              projectId={id}
              canManage={canManage}
              employees={employees ?? []}
              userRole={userRole}
              currentUserId={profile?.id}
            />
          }
          progressView={
            <ProjectProgressView
              projectId={id}
              initial={(activity ?? []) as ProjectActivityEntry[]}
            />
          }
        />
      )}
    </div>
  )
}
