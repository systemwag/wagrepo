import { MessageCircleQuestion, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { TransitionLink } from '@/components/ui/TransitionLink'
import AdminRecordsTable, { type AdminRecord, type GroupFilterOption } from '../AdminRecordsTable'

export const dynamic = 'force-dynamic'

// poll_audience из миграции 051. 'specific' — таргетированный список
// (poll_targets), 'all' — все активные сотрудники, департаментные значения
// добавлены позже миграцией 056.
const AUDIENCE_META: Record<string, { label: string; color: string }> = {
  all:           { label: 'Все',          color: 'var(--color-green)' },
  specific:      { label: 'Адресные',     color: 'var(--color-info)' },
  director:      { label: 'Директора',    color: '#a78bfa' },
  manager:       { label: 'Менеджеры',    color: '#fb923c' },
  employee:      { label: 'Сотрудники',   color: '#06b6d4' },
  admin:         { label: 'Админы',       color: 'var(--color-warn)' },
}

const GROUP_OPTIONS: GroupFilterOption[] = Object.entries(AUDIENCE_META).map(([value, m]) => ({
  value,
  label: m.label,
  color: m.color,
}))

type PollRow = {
  id: string
  question: string
  type: string
  audience: string
  closed_at: string | null
  deadline: string | null
  created_at: string | null
  created_by: string | null
  creator: { full_name: string } | { full_name: string }[] | null
}

export default async function AdminPollsPage() {
  const supabase = await createClient()

  // Параллельно: опросы + ответы + таргеты. На сотнях опросов и тысячах
  // ответов это в разы дешевле, чем RPC с агрегатами через UNION.
  const [{ data: pollsRaw }, { data: respRaw }, { data: targetRaw }] = await Promise.all([
    supabase
      .from('polls')
      .select(`
        id, question, type, audience, closed_at, deadline, created_at, created_by,
        creator:profiles!polls_created_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase.from('poll_responses').select('poll_id'),
    supabase.from('poll_targets').select('poll_id'),
  ])

  const responseCounts = new Map<string, number>()
  for (const r of (respRaw ?? []) as { poll_id: string }[]) {
    responseCounts.set(r.poll_id, (responseCounts.get(r.poll_id) ?? 0) + 1)
  }
  const targetCounts = new Map<string, number>()
  for (const r of (targetRaw ?? []) as { poll_id: string }[]) {
    targetCounts.set(r.poll_id, (targetCounts.get(r.poll_id) ?? 0) + 1)
  }

  const polls = (pollsRaw ?? []) as PollRow[]

  const records: AdminRecord[] = polls.map(p => {
    const creator = Array.isArray(p.creator) ? p.creator[0] : p.creator
    const audMeta = AUDIENCE_META[p.audience] ?? { label: p.audience, color: 'var(--color-text-muted)' }
    const isActive = p.closed_at === null
    const respN = responseCounts.get(p.id) ?? 0
    const targetN = p.audience === 'specific' ? (targetCounts.get(p.id) ?? 0) : null
    const secondaryParts = [
      audMeta.label,
      targetN !== null
        ? `${respN} из ${targetN} ответил${targetN === 1 ? '' : 'и'}`
        : `${respN} ответов`,
    ]
    if (creator?.full_name) secondaryParts.push(creator.full_name)

    return {
      id: p.id,
      primary: p.question,
      secondary: secondaryParts.join(' · '),
      meta: p.created_at
        ? new Date(p.created_at).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' })
        : null,
      badge: {
        label: isActive ? 'Активен' : 'Закрыт',
        color: isActive ? 'var(--color-green)' : 'var(--color-text-muted)',
      },
      group: p.audience,
    }
  })

  const totalActive = polls.filter(p => p.closed_at === null).length

  return (
    <div>
      <PageHeader
        icon={<MessageCircleQuestion size={18} />}
        iconTone="purple"
        title="Опросы"
        subtitle={`Всего ${polls.length}, активных ${totalActive}. Удаление каскадно сносит poll_targets, poll_responses и связанные уведомления.`}
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
      <AdminRecordsTable
        table="polls"
        records={records}
        groupFilter={GROUP_OPTIONS}
        allowOlderThanCleanup={false}
      />
    </div>
  )
}
