import { redirect } from 'next/navigation'
import { Bell } from 'lucide-react'
import { getProfile, createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import NotificationsList from '@/components/NotificationsList'
import PushToggle from '@/components/PushToggle'

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
    <div>
      <PageHeader
        icon={<Bell size={18} />}
        iconTone="info"
        title="Уведомления"
      />
      <PushToggle />
      <NotificationsList initialNotifications={notifications ?? []} userId={profile.id} />
    </div>
  )
}
