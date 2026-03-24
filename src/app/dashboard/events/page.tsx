import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EventsCalendar from '@/components/events/EventsCalendar'

export default async function EventsPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')
  if (profile.role !== 'director') redirect('/dashboard')

  // Список активных сотрудников для выбора участников
  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name, position')
    .eq('is_active', true)
    .order('full_name')

  return (
    <EventsCalendar
      employees={employees ?? []}
      isDirector={profile.role === 'director'}
    />
  )
}
