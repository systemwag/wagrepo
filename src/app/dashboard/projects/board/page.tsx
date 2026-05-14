import { redirect } from 'next/navigation'
import { Kanban } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { hasManagerAccess } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import { TransitionLink } from '@/components/ui/TransitionLink'
import { ArrowLeft } from 'lucide-react'
import ProjectsBoardClient, { type BoardColumn, type BoardProject } from './ProjectsBoardClient'

export default async function ProjectsBoardPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()])

  if (!profile) redirect('/login')
  if (!hasManagerAccess(profile.role)) redirect('/dashboard/projects')

  const isManager = profile.role === 'manager'
  const filterByManagerId = isManager ? profile.id : null

  // Default template + его этапы — это колонки доски
  const { data: defaultTemplate } = await supabase
    .from('project_templates')
    .select('id, name, stages:template_stages(stage_key, name, order_index)')
    .eq('is_default', true)
    .eq('is_archived', false)
    .maybeSingle()

  const columns: BoardColumn[] = (() => {
    if (!defaultTemplate?.stages) return []
    const stages = (defaultTemplate.stages as Array<{ stage_key: string | null; name: string; order_index: number }>)
      .filter(s => Boolean(s.stage_key))
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
    return stages.map(s => ({ stage_key: s.stage_key as string, name: s.name, order_index: s.order_index }))
  })()

  // Загружаем активные проекты + их текущий этап
  let q = supabase
    .from('projects')
    .select(`
      id, name, client_name, contract_number, deadline, status, manager_id,
      current_stage:project_stages!projects_current_stage_id_fkey(id, stage_key, name, order_index)
    `)
    .not('status', 'in', '(completed,cancelled)')
    .order('deadline', { ascending: true, nullsFirst: false })

  if (filterByManagerId) q = q.eq('manager_id', filterByManagerId)

  const { data: rawProjects } = await q

  const projects: BoardProject[] = (rawProjects ?? []).map(p => {
    const stage = Array.isArray(p.current_stage)
      ? p.current_stage[0]
      : p.current_stage
    const s = stage as { id: string; stage_key: string | null; name: string; order_index: number } | null
    return {
      id: p.id as string,
      name: p.name as string,
      client_name: (p.client_name as string | null) ?? null,
      contract_number: (p.contract_number as string | null) ?? null,
      deadline: (p.deadline as string | null) ?? null,
      status: (p.status as string) ?? 'active',
      current_stage_key: s?.stage_key ?? null,
      current_stage_name: s?.name ?? null,
    }
  })

  return (
    <div>
      <PageHeader
        icon={<Kanban size={18} />}
        iconTone="info"
        title="Канбан проектов"
        subtitle="Двигайте проекты между этапами, чтобы отметить где они сейчас"
        back={{ href: '/dashboard/projects', label: 'К проектам' }}
        action={
          <TransitionLink
            href="/dashboard/projects"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text-muted hover-text hover-surface transition-colors"
          >
            <ArrowLeft size={16} />
            <span>К списку</span>
          </TransitionLink>
        }
      />

      {columns.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-16 rounded-2xl mt-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <Kanban size={36} className="text-text-dim opacity-40" />
          <p className="text-sm text-text-muted">Нет настроенного шаблона по умолчанию</p>
          <p className="text-xs text-text-dim">
            Создайте шаблон с этапами в Настройки → Шаблоны проектов
          </p>
        </div>
      ) : (
        <ProjectsBoardClient
          columns={columns}
          projects={projects}
          canMove={hasManagerAccess(profile.role)}
        />
      )}
    </div>
  )
}
