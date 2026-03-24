import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <Sidebar profile={profile} />
      {/* md:ml-14 — отступ под десктопный сайдбар, pb-20 md:pb-8 — под мобильный нижний бар */}
      <main className="flex-1 md:ml-14 p-4 md:p-8 pb-24 md:pb-8 min-w-0">
        {children}
      </main>
    </div>
  )
}
