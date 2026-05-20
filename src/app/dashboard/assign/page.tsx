import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ClipboardList, Globe } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import AssignTaskList from '@/components/assign/AssignTaskList'
import { fetchAssignTasksPage } from './actions'
import { queryAssignTasks } from './queries'
import { ASSIGN_PAGE_SIZE } from './constants'
import { hasManagerAccess, hasDirectorAccess } from '@/lib/roles'

export default async function AssignJournalPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!hasManagerAccess(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  // Все три запроса параллельно, без повторной авторизации внутри Server Action —
  // queryAssignTasks работает с уже валидированным supabase.
  const [{ data: employees }, { count: total }, initial] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, position')
      .in('role', ['employee', 'manager', 'director'])
      .neq('id', profile.id)
      .order('full_name', { ascending: true }),
    supabase
      .from('direct_tasks')
      .select('id', { count: 'exact', head: true })
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
        title="Журнал моих поручений"
        subtitle={`${total ?? 0} ${total === 1 ? 'поручение' : 'поручений'} — задания, которые выдали вы лично`}
        action={
          hasDirectorAccess(profile.role) ? (
            <Link
              href="/dashboard/assign/all"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              <Globe size={14} />
              Все поручения системы
            </Link>
          ) : null
        }
      />
      <AssignTaskList
        initialTasks={safeTasks}
        employees={safeEmployees}
        currentUserId={profile.id}
        loadMore={fetchAssignTasksPage}
        pageSize={ASSIGN_PAGE_SIZE}
      />
    </div>
  )
}
