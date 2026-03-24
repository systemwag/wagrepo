import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import AssignTaskList from '@/components/assign/AssignTaskList'

export default async function AssignJournalPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'director') redirect('/dashboard')

  const supabase = await createClient()

  const [{ data: employees }, { data: tasks }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, position')
      .in('role', ['employee', 'manager'])
      .order('full_name', { ascending: true }),
    supabase
      .from('tasks')
      .select(`
        id, title, description, priority, status, deadline, employee_note,
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, position)
      `)
      .is('project_id', null)
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false }),
  ])

  const safeEmployees = (employees ?? []) as { id: string; full_name: string; position: string | null }[]
  const safeTasks = (tasks ?? []) as any[]

  return (
    <div>
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-semibold" style={{ color: 'var(--text)' }}>Журнал поручений</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Все выданные задания, статусы и обратная связь от сотрудников
        </p>
      </div>
      <AssignTaskList initialTasks={safeTasks} employees={safeEmployees} />
    </div>
  )
}
