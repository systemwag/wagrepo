import { unstable_cache } from 'next/cache'
import { GanttChart as GanttIcon } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PageHeader } from '@/components/ui/PageHeader'
import GanttChart, { type Project, type Stage } from './GanttChart'

// PostgREST возвращает один-к-одному отношение либо как объект, либо как массив
// (зависит от FK-метаданных). Нормализуем в скаляр здесь, чтобы клиент работал
// с обычными string-полями без Array.isArray-костылей.
type Named = { full_name: string } | { full_name: string }[] | null | undefined

function nameOf(v: Named): string | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0]?.full_name ?? null
  return v.full_name ?? null
}

async function loadGanttData(supabase: SupabaseClient, managerId: string | null) {
  let query = supabase
    .from('projects')
    .select(`
      id, name, status, start_date, deadline, client_name,
      manager:profiles!projects_manager_id_fkey(full_name),
      stages:project_stages!project_stages_project_id_fkey(
        id, name, order_index, status, start_date, deadline,
        assignee:profiles!project_stages_assignee_id_fkey(full_name)
      )
    `)
    .order('start_date', { ascending: true, nullsFirst: false })

  if (managerId) query = query.eq('manager_id', managerId)

  const { data: rawProjects } = await query

  const stageIds: string[] = []
  ;(rawProjects ?? []).forEach(p => {
    const stages = (p as { stages?: { id: string }[] }).stages ?? []
    stages.forEach(s => stageIds.push(s.id))
  })

  // Прогресс каждого этапа — % завершённых задач. Один запрос, group-by в JS.
  const progressMap = new Map<string, { total: number; done: number }>()
  if (stageIds.length > 0) {
    const { data: tasks } = await supabase
      .from('project_tasks')
      .select('stage_id, status')
      .in('stage_id', stageIds)

    for (const t of (tasks ?? []) as { stage_id: string | null; status: string }[]) {
      if (!t.stage_id) continue
      const cur = progressMap.get(t.stage_id) ?? { total: 0, done: 0 }
      cur.total++
      if (t.status === 'done') cur.done++
      progressMap.set(t.stage_id, cur)
    }
  }

  const projects: Project[] = (rawProjects ?? []).map(rp => {
    const r = rp as Record<string, unknown>
    const stagesRaw = (r.stages as unknown[]) ?? []
    return {
      id:           r.id as string,
      name:         r.name as string,
      status:       r.status as string,
      start_date:   (r.start_date  as string | null) ?? null,
      deadline:     (r.deadline    as string | null) ?? null,
      client_name:  (r.client_name as string | null) ?? null,
      manager_name: nameOf(r.manager as Named),
      stages: stagesRaw.map(rs => {
        const s = rs as Record<string, unknown>
        const sid = s.id as string
        const prog = progressMap.get(sid) ?? { total: 0, done: 0 }
        return {
          id:            sid,
          name:          s.name as string,
          order_index:   s.order_index as number,
          status:        (s.status     as string | null) ?? null,
          start_date:    (s.start_date as string | null) ?? null,
          deadline:      (s.deadline   as string | null) ?? null,
          assignee_name: nameOf(s.assignee as Named),
          total_tasks:   prog.total,
          done_tasks:    prog.done,
        } satisfies Stage
      }),
    }
  })

  return projects
}

const cachedGanttData = unstable_cache(
  async (managerId: string | null) => {
    const supabase = await createClient()
    return loadGanttData(supabase, managerId)
  },
  ['gantt-data'],
  { revalidate: 60, tags: ['gantt-data'] },
)

export default async function GanttPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const isDirector = profile.role === 'director' || profile.role === 'admin'
  const isManager  = profile.role === 'manager'
  if (!isDirector && !isManager) redirect('/dashboard')

  // Менеджер видит только свои проекты (manager_id = me), директор — все.
  const projects = await cachedGanttData(isManager ? profile.id : null)

  return (
    <div>
      <PageHeader
        icon={<GanttIcon size={18} />}
        iconTone="info"
        title="График Ганта"
        subtitle={isManager
          ? 'Ваши проекты на временной шкале'
          : 'Временная шкала проектов и этапов'}
      />
      <GanttChart projects={projects} />
    </div>
  )
}
