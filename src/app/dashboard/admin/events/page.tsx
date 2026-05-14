import { Calendar, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { TransitionLink } from '@/components/ui/TransitionLink'
import AdminRecordsTable, { type AdminRecord } from '../AdminRecordsTable'

export const dynamic = 'force-dynamic'

export default async function AdminEventsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, title, description, date, created_at')
    .order('created_at', { ascending: false })

  if (error) console.error('[admin/events] ERROR:', error.message, error.code)

  const records: AdminRecord[] = (data ?? []).map(r => ({
    id: r.id as string,
    primary: (r.title as string) || '(без названия)',
    secondary: (r.description as string | null) ?? null,
    meta: r.date
      ? new Date(r.date as string).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' })
      : r.created_at ? new Date(r.created_at as string).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' }) : null,
    badge: null,
  }))

  return (
    <div>
      <PageHeader
        icon={<Calendar size={18} />}
        iconTone="info"
        title="Управление событиями"
        subtitle="Корпоративные события и мероприятия. Удаление каскадно затрагивает участников."
        back={{ href: '/dashboard/admin', label: 'В админ-панель' }}
        action={
          <TransitionLink
            href="/dashboard/admin"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text-muted hover-text hover-surface transition-colors"
          >
            <ArrowLeft size={16} />
            <span>В админ</span>
          </TransitionLink>
        }
      />
      <AdminRecordsTable table="events" records={records} />
    </div>
  )
}
