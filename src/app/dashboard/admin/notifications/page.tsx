import { Bell, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { TransitionLink } from '@/components/ui/TransitionLink'
import AdminRecordsTable, { type AdminRecord, type GroupFilterOption } from '../AdminRecordsTable'
import OrphanCleanupButton from './OrphanCleanupButton'
import { adminDeleteNotificationsByType } from '@/lib/actions/admin'

export const dynamic = 'force-dynamic'

// Маппинг type → русский ярлык + цвет. Используем и для badge, и для селекта
// фильтра — единый источник истины, чтобы при добавлении нового типа
// в schema его достаточно было прописать один раз.
const TYPE_META: Record<string, { label: string; color: string }> = {
  poll:         { label: 'Опрос',     color: '#a78bfa' },
  event:        { label: 'Событие',   color: '#06b6d4' },
  project:      { label: 'Проект',    color: 'var(--color-green)' },
  direct_task:  { label: 'Поручение', color: 'var(--color-warn)' },
  project_task: { label: 'Задача',    color: 'var(--color-info)' },
  system:       { label: 'Система',   color: 'var(--color-text-muted)' },
}

const GROUP_OPTIONS: GroupFilterOption[] = Object.entries(TYPE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
  color: meta.color,
}))

export default async function AdminNotificationsPage() {
  const supabase = await createClient()
  // Лимит 5000 — на масштабе компании (~50 человек) этого с запасом хватает,
  // но позволяет увидеть хвост, который вылез из-за дублей до миграции 067.
  const { data } = await supabase
    .from('notifications')
    .select('id, title, message, type, created_at')
    .order('created_at', { ascending: false })
    .limit(5000)

  const records: AdminRecord[] = (data ?? []).map(r => {
    const type = (r.type as string) ?? 'system'
    const meta = TYPE_META[type] ?? { label: type, color: 'var(--color-text-muted)' }
    return {
      id: r.id as string,
      primary: (r.title as string) || '(без названия)',
      secondary: (r.message as string | null) ?? null,
      meta: r.created_at
        ? new Date(r.created_at as string).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' })
        : null,
      badge: { label: meta.label, color: meta.color },
      group: type,
    }
  })

  async function bulkByGroup(group: string) {
    'use server'
    return adminDeleteNotificationsByType(group)
  }

  return (
    <div>
      <PageHeader
        icon={<Bell size={18} />}
        iconTone="warn"
        title="Уведомления"
        subtitle="Системные и пользовательские уведомления. Показаны последние 5000. Фильтр по типу + кнопка очистки мёртвых ссылок."
        back={{ href: '/dashboard/admin', label: 'В админ-панель' }}
        action={
          <div className="flex items-center gap-2">
            <OrphanCleanupButton />
            <TransitionLink
              href="/dashboard/admin"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text-muted hover-text hover-surface transition-colors"
            >
              <ArrowLeft size={16} />
              <span>В админ</span>
            </TransitionLink>
          </div>
        }
      />
      <AdminRecordsTable
        table="notifications"
        records={records}
        groupFilter={GROUP_OPTIONS}
        bulkByGroup={bulkByGroup}
      />
    </div>
  )
}
