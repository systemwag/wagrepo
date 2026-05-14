import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import MyAssignmentsList, { type Assignment } from '@/components/tasks/MyAssignmentsList'
import { fetchMyAssignmentsPage } from './actions'
import { ASSIGNMENTS_PAGE_SIZE } from './constants'

const SELECT = `
  id, title, description, employee_note, status, priority, deadline,
  creator:profiles!direct_tasks_created_by_fkey(full_name)
`

export default async function AssignmentsPage() {
  const [supabase, profile] = await Promise.all([
    createClient(), getProfile(),
  ])

  if (!profile) redirect('/login')
  const userId = profile.id

  // Один запрос вместо двух: возвращает строки + count.
  const { data, count } = await supabase
    .from('direct_tasks')
    .select(SELECT, { count: 'exact' })
    .eq('assignee_id', userId)
    .order('deadline', { ascending: true, nullsFirst: false })
    .range(0, ASSIGNMENTS_PAGE_SIZE - 1)

  const initial: Assignment[] = (data ?? []).map(row => {
    const r = row as Record<string, unknown>
    const c = r.creator
    const creator = Array.isArray(c) ? (c[0] as Assignment['creator']) ?? null : (c as Assignment['creator'])
    return { ...r, creator } as Assignment
  })

  return (
    <div>
      <PageHeader
        icon={<Send size={18} />}
        iconTone="warn"
        title="Мои поручения"
        subtitle={`${count ?? 0} поручений от руководства`}
      />
      <MyAssignmentsList
        initialTasks={initial}
        loadMore={fetchMyAssignmentsPage}
        pageSize={ASSIGNMENTS_PAGE_SIZE}
      />
    </div>
  )
}
