import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import NotificationsList from '@/components/NotificationsList'

export default async function NotificationsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Уведомления</h1>
      </div>
      <NotificationsList initialNotifications={notifications ?? []} userId={profile.id} />
    </div>
  )
}
