import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MyStagesView, { type StageWithProject, type Task } from '@/components/tasks/MyStagesView'

export default async function TasksPage() {
  const [supabase, profile] = await Promise.all([
    createClient(),
    getProfile(),
  ])

  if (!profile) redirect('/login')
  const userId = profile.id

  const [{ data: stages }, { data: tasks }] = await Promise.all([
    supabase
      .from('project_stages')
      .select(`
        *,
        project:projects!project_stages_project_id_fkey(id, name, status, deadline),
        assignee:profiles!project_stages_assignee_id_fkey(id, full_name),
        checklist_items:stage_checklist_items(*),
        stage_documents:documents!stage_id(*)
      `)
      .eq('assignee_id', userId)
      .order('deadline', { ascending: true, nullsFirst: false }),
    supabase
      .from('tasks')
      .select(`
        id, title, description, employee_note, status, priority, deadline,
        project:projects(id, name),
        assignee:profiles!tasks_assignee_id_fkey(full_name),
        creator:profiles!tasks_created_by_fkey(full_name)
      `)
      .or(`assignee_id.eq.${userId},and(created_by.eq.${userId},assignee_id.is.null)`)
      .not('project_id', 'is', null)
      .neq('status', 'done')
      .order('deadline', { ascending: true, nullsFirst: false }),
  ])

  const normalizedStages = (stages ?? []).map(s => ({
    ...s,
    status: s.status ?? 'pending',
    checklist_items: Array.isArray(s.checklist_items)
      ? s.checklist_items.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
      : [],
    stage_documents: Array.isArray(s.stage_documents)
      ? s.stage_documents.sort((a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at))
      : [],
  }))

  return (
    <div>
      <MyStagesView
        stages={normalizedStages as unknown as StageWithProject[]}
        tasks={(tasks ?? []) as unknown as Task[]}
        userRole={profile.role}
      />
    </div>
  )
}
