import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmployeeList from './EmployeeList'

export default async function EmployeesPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])

  if (profile?.role !== 'director') redirect('/dashboard')

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name, role, position, department, birth_date, is_active')
    .order('role')
    .order('full_name')

  return <EmployeeList employees={employees ?? []} />
}
