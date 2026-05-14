import { createClient, getProfile } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import EmployeeList from './EmployeeList'
import { hasDirectorAccess } from '@/lib/roles'

export default async function EmployeesPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])

  if (!hasDirectorAccess(profile?.role)) redirect('/dashboard')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, position, department, birth_date, phone, is_active')
    .order('role')
    .order('full_name')

  // Email лежит в auth.users — доступен только через admin API. Страница защищена requireDirector().
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById = new Map(users.map(u => [u.id, u.email ?? '']))

  const employees = (profiles ?? []).map(p => ({
    ...p,
    email: emailById.get(p.id) ?? '',
  }))

  return <EmployeeList employees={employees} />
}
