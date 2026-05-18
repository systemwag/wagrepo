import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckSquare } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import MyWorkOverview, {
  type StageOverview,
  type TaskOverview,
} from '@/components/tasks/MyWorkOverview'

// Read-only обзор «Что у меня на руках по проектам».
// Все изменения статусов, чек-листа и документов делаются ТОЛЬКО на странице
// проекта — здесь только сводка с ссылками туда же.

export default async function TasksOverviewPage() {
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
        id, name, order_index, status, deadline, review_status,
        project:projects!project_stages_project_id_fkey(id, name),
        checklist_items:stage_checklist_items(id, is_completed),
        documents_count:documents!stage_id(id)
      `)
      .eq('assignee_id', userId)
      .order('deadline', { ascending: true, nullsFirst: false }),
    supabase
      .from('project_tasks')
      .select(`
        id, title, status, priority, deadline, employee_note,
        project:projects(id, name)
      `)
      .eq('assignee_id', userId)
      .neq('status', 'done')
      .order('deadline', { ascending: true, nullsFirst: false }),
  ])

  // checklist_items приходят массивом строк {id, is_completed} — превращаем в счётчики.
  const stagesOverview: StageOverview[] = (stages ?? []).map(s => {
    const items = Array.isArray(s.checklist_items) ? s.checklist_items : []
    const done = items.filter((i: { is_completed?: boolean }) => i.is_completed).length
    const docs = Array.isArray(s.documents_count) ? s.documents_count.length : 0
    const proj = Array.isArray(s.project) ? s.project[0] : s.project
    return {
      id:            s.id as string,
      name:          s.name as string,
      order_index:   s.order_index as number,
      status:        (s.status ?? 'pending') as StageOverview['status'],
      deadline:      (s.deadline ?? null) as string | null,
      review_status: (s.review_status ?? null) as StageOverview['review_status'],
      checklist_done:  done,
      checklist_total: items.length,
      documents_count: docs,
      project: proj ?? null,
    }
  })

  const tasksOverview: TaskOverview[] = (tasks ?? []).map(t => {
    const proj = Array.isArray(t.project) ? t.project[0] : t.project
    return {
      id:            t.id as string,
      title:         t.title as string,
      status:        (t.status ?? 'todo') as TaskOverview['status'],
      priority:      (t.priority ?? 'medium') as TaskOverview['priority'],
      deadline:      (t.deadline ?? null) as string | null,
      employee_note: (t.employee_note ?? null) as string | null,
      project: proj ?? null,
    }
  })

  return (
    <div>
      <PageHeader
        icon={<CheckSquare size={18} />}
        iconTone="info"
        title="Мои задачи по проектам"
        subtitle="Сводка по этапам и задачам. Для действий откройте проект."
      />
      <MyWorkOverview stages={stagesOverview} tasks={tasksOverview} />
    </div>
  )
}
