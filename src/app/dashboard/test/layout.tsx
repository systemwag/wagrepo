import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/server'

export default async function TestLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'director') redirect('/dashboard')
  return <>{children}</>
}
