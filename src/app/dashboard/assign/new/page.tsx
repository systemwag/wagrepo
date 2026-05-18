import { redirect } from 'next/navigation'
import { Send } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import AssignTaskForm from '@/components/assign/AssignTaskForm'
import { hasManagerAccess } from '@/lib/roles'
import { getUsersWip } from '@/lib/wip'

export default async function AssignNewPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!hasManagerAccess(profile.role)) redirect('/dashboard')

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

  // WIP-загрузка для всех — чтобы директор сразу видел перегруженных
  const allIds = [...safeEmployees, ...safeManagers, ...safeDirectors].map(p => p.id)
  const wipMap = await getUsersWip(supabase, allIds)
  const wipObj: Record<string, { active: number; limit: number; state: 'ok' | 'warning' | 'over' }> = {}
  wipMap.forEach((v, k) => { wipObj[k] = v })

  return (
    <div>
      <PageHeader
        icon={<Send size={18} />}
        iconTone="warn"
        title="Новое поручение"
        subtitle="Создайте персональное задание или напоминание для сотрудника"
        back={{ href: '/dashboard/assign', label: 'К журналу' }}
      />
      <div className="card p-7">
        <AssignTaskForm
          employees={safeEmployees}
          managers={safeManagers}
          directors={safeDirectors}
          wipByUserId={wipObj}
        />
      </div>
    </div>
  )
}
