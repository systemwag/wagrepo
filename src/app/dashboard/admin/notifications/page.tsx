import { Bell, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { TransitionLink } from '@/components/ui/TransitionLink'
import AdminRecordsTable, { type AdminRecord } from '../AdminRecordsTable'

export const dynamic = 'force-dynamic'

const TYPE_COLOR: Record<string, string> = {
  project_task: 'var(--color-info)',
  direct_task:  '#a78bfa',
  project:      'var(--color-green)',
  event:        '#06b6d4',
  system:       'var(--color-text-muted)',
}

export default async function AdminNotificationsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, title, message, type, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const records: AdminRecord[] = (data ?? []).map(r => ({
    id: r.id as string,
    primary: (r.title as string) || '(без названия)',
    secondary: (r.message as string | null) ?? null,
    meta: r.created_at ? new Date(r.created_at as string).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' }) : null,
    badge: r.type
      ? { label: r.type as string, color: TYPE_COLOR[r.type as string] }
      : null,
  }))

  return (
    <div>
      <PageHeader
        icon={<Bell size={18} />}
        iconTone="warn"
        title="Уведомления"
        subtitle="Системные и пользовательские уведомления. Показаны последние 500. Рекомендуем регулярную чистку."
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
      <AdminRecordsTable table="notifications" records={records} />
    </div>
  )
}
