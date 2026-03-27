import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import AssignTaskForm from '@/components/assign/AssignTaskForm'

export default async function AssignNewPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'director') redirect('/dashboard')

  const supabase = await createClient()

  const [{ data: employees }, { data: managers }, { data: directors }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, position')
      .eq('role', 'employee')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, position')
      .eq('role', 'manager')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, position')
      .eq('role', 'director')
      .neq('id', profile.id)
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
  ])

  type Person = { id: string; full_name: string; position: string | null }
  const safeEmployees = (employees ?? []) as Person[]
  const safeManagers  = (managers  ?? []) as Person[]
  const safeDirectors = (directors ?? []) as Person[]

  return (
    <div style={{ maxWidth: '680px' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Новое поручение</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Создайте персональное задание или напоминание для сотрудника
        </p>
      </div>
      <div className="card p-7">
        <AssignTaskForm employees={safeEmployees} managers={safeManagers} directors={safeDirectors} />
      </div>
    </div>
  )
}
