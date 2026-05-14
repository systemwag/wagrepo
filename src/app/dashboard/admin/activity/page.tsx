import { Activity, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { TransitionLink } from '@/components/ui/TransitionLink'
import AdminRecordsTable, { type AdminRecord } from '../AdminRecordsTable'

export const dynamic = 'force-dynamic'

export default async function AdminActivityPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('activity_log')
    .select('id, action, entity_type, meta, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const records: AdminRecord[] = (data ?? []).map(r => {
    const meta = r.meta as Record<string, unknown> | null
    const titleFromMeta = (meta?.title ?? meta?.name) as string | undefined
    return {
      id: r.id as string,
      primary: (r.action as string) || '(action)',
      secondary: titleFromMeta ?? `${r.entity_type ?? ''}`,
      meta: r.created_at
        ? new Date(r.created_at as string).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' })
        : null,
      badge: r.entity_type
        ? { label: r.entity_type as string, color: 'var(--color-info)' }
        : null,
    }
  })

  return (
    <div>
      <PageHeader
        icon={<Activity size={18} />}
        iconTone="warn"
        title="Лог активности"
        subtitle="Аудит-лог действий в системе. Авто-чистка раз в сутки удаляет записи старше 30 дней."
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
      <AdminRecordsTable table="activity_log" records={records} />
    </div>
  )
}
