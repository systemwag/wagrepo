import { createClient, getProfile } from '@/lib/supabase/server'
import EmployeeList from './EmployeeList'

export default async function EmployeesPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name, role, position, department, is_active')
    .order('role')
    .order('full_name')

  const canManage = profile?.role === 'director'

  return (
    <EmployeeList
      employees={employees ?? []}
      canManage={canManage}
    />
  )
}
