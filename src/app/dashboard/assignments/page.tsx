import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import MyAssignmentsList, { type Assignment } from '@/components/tasks/MyAssignmentsList'
import { fetchMyAssignmentsPage } from './actions'
import { ASSIGNMENTS_PAGE_SIZE } from './constants'

export default async function AssignmentsPage() {
  const [supabase, profile] = await Promise.all([
    createClient(), getProfile(),
  ])

  if (!profile) redirect('/login')
  const userId = profile.id

  const [{ count: total }, initial] = await Promise.all([
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assignee_id', userId)
      .is('project_id', null),
    fetchMyAssignmentsPage(0),
  ])

  return (
    <div>
      <PageHeader
        icon={<Send size={18} />}
        iconTone="warn"
        title="Мои поручения"
        subtitle={`${total ?? 0} заданий от руководства`}
      />
      <MyAssignmentsList
        initialTasks={initial as unknown as Assignment[]}
        loadMore={fetchMyAssignmentsPage}
        pageSize={ASSIGNMENTS_PAGE_SIZE}
      />
    </div>
  )
}
