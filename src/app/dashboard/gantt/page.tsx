import { GanttChart as GanttIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import GanttChart, { type Project } from './GanttChart'

export default async function GanttPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
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

  return (
    <div>
      <PageHeader
        icon={<GanttIcon size={18} />}
        iconTone="info"
        title="График Ганта"
        subtitle="Временная шкала проектов и этапов"
      />
      <GanttChart projects={(projects ?? []) as unknown as Project[]} />
    </div>
  )
}
