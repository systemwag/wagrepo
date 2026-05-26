import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageCircleQuestion, Plus, ArrowRight, Clock, CheckCircle2 } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader, CardEmpty } from '@/components/ui/Card'
import { queryPollsAddressedToMe, queryMyPollsPage, type PollSummary } from './queries'
import { POLLS_PAGE_SIZE, POLL_STATUS_TABS, type PollStatusFilter } from './constants'
import MyPollsList from './MyPollsList'
import { formatNameShort } from '@/lib/utils/name'

function parseTab(raw: string | string[] | undefined): PollStatusFilter {
  const v = Array.isArray(raw) ? raw[0] : raw
  return POLL_STATUS_TABS.some(t => t.key === v) ? (v as PollStatusFilter) : 'all'
}

export default async function PollsJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const sp = await searchParams
  const tab = parseTab(sp?.tab)

  const supabase = await createClient()
  const [addressed, mineInitial] = await Promise.all([
    queryPollsAddressedToMe(supabase, profile.id),
    queryMyPollsPage(supabase, profile.id, 0, POLLS_PAGE_SIZE, tab),
  ])

  return (
    <div>
      <PageHeader
        icon={<MessageCircleQuestion size={18} />}
        iconTone="info"
        title="Опросы"
        subtitle="Создайте опрос команде или ответьте на те, что направлены вам"
        action={
          <Link
            href="/dashboard/polls/new"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors hover-border"
            style={{
              background: 'color-mix(in oklab, var(--color-green) 12%, transparent)',
              color: 'var(--color-green)',
              borderColor: 'color-mix(in oklab, var(--color-green) 30%, transparent)',
            }}
          >
            <Plus size={15} />
            Новый опрос
          </Link>
        }
      />

      <div className="grid gap-4 md:gap-6">
        {/* Адресовано мне — без пагинации, обычно мало */}
        <Card>
          <CardHeader
            icon={<MessageCircleQuestion size={18} />}
            title="Адресовано мне"
            count={addressed.length}
            countTone="warn"
          />
          {addressed.length === 0 ? (
            <CardEmpty icon={<CheckCircle2 size={40} />} text="Нет неотвеченных опросов" />
          ) : (
            <div>
              {addressed.map((p, i) => (
                <AddressedRow key={p.id} poll={p} isLast={i === addressed.length - 1} />
              ))}
            </div>
          )}
        </Card>

        {/* Мои опубликованные — таб + LoadMore (клиент) */}
        <MyPollsList initial={mineInitial} initialTab={tab} />
      </div>
    </div>
  )
}

function AddressedRow({ poll, isLast }: { poll: PollSummary; isLast: boolean }) {
  return (
    <Link
      href={`/dashboard/polls/${poll.id}`}
      className="flex items-start gap-3 px-4 py-3 @md:px-6 transition-colors hover:bg-surface-2/40"
      style={{ borderBottom: !isLast ? '1px solid var(--color-border)' : undefined }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text leading-snug">{poll.question}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-text-dim">
          {poll.author && <span>от {formatNameShort(poll.author.full_name)}</span>}
          <span className="inline-flex items-center gap-1">
            <Clock size={11} />
            до {formatDeadline(poll.deadline)}
          </span>
          <span>{typeLabel(poll.type)}</span>
        </div>
      </div>
      <ArrowRight size={16} className="text-text-dim shrink-0 mt-1" />
    </Link>
  )
}

function typeLabel(t: PollSummary['type']) {
  return t === 'text' ? 'текстовый' : t === 'single_choice' ? 'один вариант' : 'несколько вариантов'
}

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Oral', day: 'numeric', month: 'short',
  })
}
