import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'

// Тестовые модули видны только admin — это служебная зона разработчика.
export default async function TestLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!isAdmin(profile.role)) redirect('/dashboard')
  return <>{children}</>
}
