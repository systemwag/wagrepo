import { CheckSquare, Send, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { TransitionLink } from '@/components/ui/TransitionLink'
import AdminRecordsTable, { type AdminRecord } from '../AdminRecordsTable'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  todo:        'var(--color-text-muted)',
  in_progress: 'var(--color-info)',
  done:        'var(--color-green)',
  cancelled:   'var(--color-text-dim)',
}

const STATUS_LABEL: Record<string, string> = {
  todo:        'В очереди',
  in_progress: 'В работе',
  done:        'Готово',
  cancelled:   'Отменено',
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  const { kind } = await searchParams
  const isDirect = kind === 'direct'
  const table = isDirect ? 'direct_tasks' : 'project_tasks'
  const title = isDirect ? 'Прямые поручения' : 'Задачи проектов'

  const supabase = await createClient()
  const { data } = await supabase
    .from(table)
    .select('id, title, status, created_at, description')
    .order('created_at', { ascending: false })

  const records: AdminRecord[] = (data ?? []).map(r => ({
    id: r.id as string,
    primary: (r.title as string) || '(без названия)',
    secondary: (r.description as string | null) ?? null,
    meta: r.created_at ? new Date(r.created_at as string).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' }) : null,
    badge: r.status
      ? { label: STATUS_LABEL[r.status as string] ?? (r.status as string), color: STATUS_COLOR[r.status as string] }
      : null,
  }))

  const Icon = isDirect ? Send : CheckSquare

  return (
    <div>
      <PageHeader
        icon={<Icon size={18} />}
        iconTone="info"
        title={title}
        subtitle={isDirect
          ? 'Прямые поручения (без привязки к проекту). Удаление каскадно затрагивает task_reports.'
          : 'Задачи внутри проектов. Удаление каскадно затрагивает task_reports и assignees.'}
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

      {/* Переключатель между типами задач */}
      <div className="flex gap-2 mb-4">
        <TransitionLink
          href="/dashboard/admin/tasks?kind=project"
          className="text-sm px-3 py-1.5 rounded-lg"
          style={{
            background: !isDirect ? 'color-mix(in oklab, var(--color-green) 15%, transparent)' : 'var(--color-surface-2)',
            color: !isDirect ? 'var(--color-green)' : 'var(--color-text-muted)',
            border: `1px solid ${!isDirect ? 'color-mix(in oklab, var(--color-green) 30%, transparent)' : 'var(--color-border)'}`,
          }}
        >
          Задачи проектов
        </TransitionLink>
        <TransitionLink
          href="/dashboard/admin/tasks?kind=direct"
          className="text-sm px-3 py-1.5 rounded-lg"
          style={{
            background: isDirect ? 'color-mix(in oklab, var(--color-green) 15%, transparent)' : 'var(--color-surface-2)',
            color: isDirect ? 'var(--color-green)' : 'var(--color-text-muted)',
            border: `1px solid ${isDirect ? 'color-mix(in oklab, var(--color-green) 30%, transparent)' : 'var(--color-border)'}`,
          }}
        >
          Прямые поручения
        </TransitionLink>
      </div>

      <AdminRecordsTable table={table} records={records} />
    </div>
  )
}
