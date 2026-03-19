import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <Sidebar profile={profile} />
      <main className="flex-1 ml-14 p-8 min-w-0">
        {children}
      </main>
    </div>
  )
}
