import { redirect } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import AssignTaskList from '@/components/assign/AssignTaskList'
import { fetchAllAssignTasksPage } from '../actions'
import { queryAllAssignTasks } from '../queries'
import { ASSIGN_PAGE_SIZE } from '../constants'
import { isAdmin } from '@/lib/roles'

/**
 * Все поручения системы — только для admin. Видны чужие поручения, но
 * редактировать можно только свои (created_by = currentUserId).
 */
export default async function AllAssignTasksPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!isAdmin(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  const [{ data: employees }, { count: total }, initial] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, position')
      .in('role', ['employee', 'manager', 'director', 'admin'])
      .neq('id', profile.id)
      .order('full_name', { ascending: true }),
    supabase
      .from('direct_tasks')
      .select('id', { count: 'exact', head: true }),
    queryAllAssignTasks(supabase, 0),
  ])

  const safeEmployees = (employees ?? []) as { id: string; full_name: string; position: string | null }[]

  return (
    <div>
      <PageHeader
        icon={<ClipboardList size={18} />}
        iconTone="green"
        title="Все поручения системы"
        subtitle={`${total ?? 0} ${total === 1 ? 'поручение' : 'поручений'} — все выданные задания в WAG System`}
        back={{ href: '/dashboard/assign', label: 'К моим поручениям' }}
      />
      <AssignTaskList
        initialTasks={initial}
        employees={safeEmployees}
        currentUserId={profile.id}
        showCreator
        loadMore={fetchAllAssignTasksPage}
        pageSize={ASSIGN_PAGE_SIZE}
      />
    </div>
  )
}
