import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import PushInit from '@/components/PushInit'
import PushPermissionBanner from '@/components/PushPermissionBanner'
import InstallAppBanner from '@/components/InstallAppBanner'
import GlobalSearch from '@/components/GlobalSearch'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { ToastProvider } from '@/components/ui/Toast'
import NavigationProgress from '@/components/NavigationProgress'
import { PageFade } from '@/components/PageFade'
import { Suspense } from 'react'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
        <Sidebar profile={profile} />
        {/* md:ml-14 — отступ под десктопный сайдбар, pb-20 md:pb-8 — под мобильный нижний бар */}
        <main className="flex-1 md:ml-14 p-4 md:p-8 pb-24 md:pb-8 min-w-0">
          <div className="mx-auto w-full max-w-7xl">
            <InstallAppBanner />
            <PushPermissionBanner />
            <PullToRefresh>
              <PageFade>
                {children}
              </PageFade>
            </PullToRefresh>
          </div>
        </main>
        <PushInit />
        <GlobalSearch />
      </div>
    </ToastProvider>
  )
}
