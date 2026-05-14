import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'

// Любая страница /dashboard/admin/* доступна только пользователю с ролью admin.
// RLS в БД — независимый страж, layout просто перенаправляет на /dashboard
// до того, как пользователь увидит UI.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!isAdmin(profile.role)) redirect('/dashboard')
  return <>{children}</>
}
