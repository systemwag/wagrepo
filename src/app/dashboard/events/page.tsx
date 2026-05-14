import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EventsCalendar from '@/components/events/EventsCalendar'
import { hasDirectorAccess } from '@/lib/roles'

export default async function EventsPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')

  const isDirector = hasDirectorAccess(profile.role)
  // Список сотрудников нужен только директору (или admin) для создания мероприятий
  const employees = isDirector
    ? (await supabase.from('profiles').select('id, full_name, position').eq('is_active', true).order('full_name')).data ?? []
    : []

  return (
    <EventsCalendar
      employees={employees}
      isDirector={isDirector}
    />
  )
}
