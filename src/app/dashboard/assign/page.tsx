import { redirect } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import AssignTaskList from '@/components/assign/AssignTaskList'
import { fetchAssignTasksPage } from './actions'
import { queryAssignTasks } from './queries'
import { ASSIGN_PAGE_SIZE } from './constants'

export default async function AssignJournalPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'director') redirect('/dashboard')

  const supabase = await createClient()

  // Все три запроса параллельно, без повторной авторизации внутри Server Action —
  // queryAssignTasks работает с уже валидированным supabase.
  const [{ data: employees }, { count: total }, initial] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, position')
      .in('role', ['employee', 'manager'])
      .order('full_name', { ascending: true }),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .is('project_id', null)
      .eq('created_by', profile.id),
    queryAssignTasks(supabase, profile.id, 0),
  ])

  const safeEmployees = (employees ?? []) as { id: string; full_name: string; position: string | null }[]
  const safeTasks = initial

  return (
    <div>
      <PageHeader
        icon={<ClipboardList size={18} />}
        iconTone="green"
        title="Журнал поручений"
        subtitle={`${total ?? 0} поручений — все выданные задания, статусы и обратная связь от сотрудников`}
      />
      <AssignTaskList
        initialTasks={safeTasks}
        employees={safeEmployees}
        directorId={profile.id}
        loadMore={fetchAssignTasksPage}
        pageSize={ASSIGN_PAGE_SIZE}
      />
    </div>
  )
}
