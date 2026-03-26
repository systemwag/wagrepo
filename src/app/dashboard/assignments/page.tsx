import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Send } from 'lucide-react'
import MyAssignmentsList, { type Assignment } from '@/components/tasks/MyAssignmentsList'

export default async function AssignmentsPage() {
  const [supabase, profile] = await Promise.all([
    createClient(), getProfile(),
  ])

  if (!profile) redirect('/login')
  const userId = profile.id

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description, employee_note, status, priority, deadline, creator:profiles!tasks_created_by_fkey(full_name)')
    .eq('assignee_id', userId)
    .is('project_id', null)
    .order('deadline', { ascending: true, nullsFirst: false })

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
          <Send size={18} />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Мои поручения</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Задания от руководства</p>
        </div>
      </div>

      <MyAssignmentsList initialTasks={(tasks ?? []) as unknown as Assignment[]} />
    </div>
  )
}
