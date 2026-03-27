import { createClient } from '@/lib/supabase/server'
import GanttChart, { type Project } from './GanttChart'

export default async function GanttPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, name, status, start_date, deadline, client_name,
      manager:profiles!projects_manager_id_fkey(full_name),
      stages:project_stages(
        id, name, order_index, status, start_date, deadline,
        assignee:profiles!project_stages_assignee_id_fkey(full_name)
      )
    `)
    .order('start_date', { ascending: true, nullsFirst: false })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>График Ганта</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Временная шкала проектов и этапов</p>
      </div>
      <GanttChart projects={(projects ?? []) as unknown as Project[]} />
    </div>
  )
}
