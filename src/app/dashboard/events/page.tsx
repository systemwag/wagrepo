import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EventsCalendar from '@/components/events/EventsCalendar'

export default async function EventsPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')

  // Список сотрудников нужен только директору для создания мероприятий
  const employees = profile.role === 'director'
    ? (await supabase.from('profiles').select('id, full_name, position').eq('is_active', true).order('full_name')).data ?? []
    : []

  return (
    <EventsCalendar
      employees={employees}
      isDirector={profile.role === 'director'}
    />
  )
}
