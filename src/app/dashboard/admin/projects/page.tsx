import { FolderOpen, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { TransitionLink } from '@/components/ui/TransitionLink'
import AdminRecordsTable, { type AdminRecord } from '../AdminRecordsTable'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  active:    'var(--color-green)',
  on_hold:   'var(--color-warn)',
  completed: 'var(--color-info)',
  cancelled: 'var(--color-text-dim)',
}

const STATUS_LABEL: Record<string, string> = {
  active:    'Активный',
  on_hold:   'Пауза',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

export default async function AdminProjectsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('id, name, status, client_name, created_at')
    .order('created_at', { ascending: false })

  const records: AdminRecord[] = (data ?? []).map(r => ({
    id: r.id as string,
    primary: (r.name as string) || '(без названия)',
    secondary: (r.client_name as string | null) ?? null,
    meta: r.created_at ? new Date(r.created_at as string).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' }) : null,
    badge: r.status
      ? { label: STATUS_LABEL[r.status as string] ?? (r.status as string), color: STATUS_COLOR[r.status as string] }
      : null,
  }))

  return (
    <div>
      <PageHeader
        icon={<FolderOpen size={18} />}
        iconTone="green"
        title="Управление проектами"
        subtitle="Все проекты в БД. Удаление каскадно затрагивает этапы, задачи, чек-листы и документы."
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
      <AdminRecordsTable table="projects" records={records} />
    </div>
  )
}
