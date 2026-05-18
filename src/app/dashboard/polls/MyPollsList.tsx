'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, Clock, MessageCircleQuestion } from 'lucide-react'
import { Card, CardHeader, CardEmpty } from '@/components/ui/Card'
import { fetchMyPollsPage } from './actions'
import { POLL_STATUS_TABS, POLLS_PAGE_SIZE, type PollStatusFilter } from './constants'
import type { PollSummary } from './queries'

type Props = {
  initial: PollSummary[]
}

export default function MyPollsList({ initial }: Props) {
  const [tab, setTab]         = useState<PollStatusFilter>('all')
  const [items, setItems]     = useState<PollSummary[]>(initial)
  const [page, setPage]       = useState(1)
  const [done, setDone]       = useState(initial.length < POLLS_PAGE_SIZE)
  const [pending, startTransition] = useTransition()

  function changeTab(next: PollStatusFilter) {
    if (next === tab) return
    setTab(next)
    setItems([])
    setPage(1)
    setDone(false)
    startTransition(async () => {
      const fresh = await fetchMyPollsPage(0, next)
      setItems(fresh)
      setDone(fresh.length < POLLS_PAGE_SIZE)
    })
  }

  function loadMore() {
    startTransition(async () => {
      const more = await fetchMyPollsPage(page, tab)
      setItems(prev => [...prev, ...more])
      setPage(p => p + 1)
      if (more.length < POLLS_PAGE_SIZE) setDone(true)
    })
  }

  return (
    <Card>
      <CardHeader
        icon={<MessageCircleQuestion size={18} />}
        title="Мои опубликованные"
        count={items.length}
        countTone="neutral"
      />

      {/* Табы */}
      <div className="flex flex-wrap gap-1 px-4 pt-3 @md:px-6">
        {POLL_STATUS_TABS.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => changeTab(t.key)}
              disabled={pending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                background: active ? 'color-mix(in oklab, var(--color-green) 12%, transparent)' : 'transparent',
                color: active ? 'var(--color-green)' : 'var(--color-text-muted)',
                border: `1px solid ${active ? 'color-mix(in oklab, var(--color-green) 25%, transparent)' : 'transparent'}`,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {items.length === 0 ? (
        <CardEmpty icon={<MessageCircleQuestion size={40} />} text={
          tab === 'all'    ? 'Вы пока не публиковали опросы'
        : tab === 'active' ? 'Нет активных опросов'
        : tab === 'closed' ? 'Нет закрытых опросов'
        :                    'Нет просроченных опросов'
        } />
      ) : (
        <div className="mt-2">
          {items.map((p, i) => (
            <Row key={p.id} poll={p} isLast={i === items.length - 1} />
          ))}
          {!done && (
            <div className="flex justify-center py-4">
              <button
                onClick={loadMore}
                disabled={pending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                           bg-surface border border-border text-text-muted
                           hover:bg-surface-2 hover:border-border-2 hover:text-text
                           disabled:opacity-50 disabled:cursor-wait transition-colors"
              >
                {pending ? (
                  <>
                    <span className="inline-block w-3 h-3 rounded-full bg-green animate-pulse" />
                    Загружаем…
                  </>
                ) : (
                  <>
                    <ChevronDown size={15} />
                    Загрузить ещё
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function Row({ poll, isLast }: { poll: PollSummary; isLast: boolean }) {
  const status = pollStatus(poll)
  return (
    <Link
      href={`/dashboard/polls/${poll.id}`}
      className="flex items-start gap-3 px-4 py-3 @md:px-6 transition-colors hover:bg-surface-2/40"
      style={{ borderBottom: !isLast ? '1px solid var(--color-border)' : undefined }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text leading-snug">{poll.question}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-text-dim">
          <StatusBadge status={status} />
          <span>{typeLabel(poll.type)}</span>
          <span>·</span>
          <span className="num">
            {poll.audience_size > 0
              ? `${poll.response_count} из ${poll.audience_size} ${plural(poll.audience_size, 'ответил', 'ответили', 'ответили')}`
              : `${poll.response_count} ${plural(poll.response_count, 'ответ', 'ответа', 'ответов')}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={11} />
            до {formatDeadline(poll.deadline)}
          </span>
        </div>
      </div>
      <ArrowRight size={16} className="text-text-dim shrink-0 mt-1" />
    </Link>
  )
}

type Status = 'active' | 'closed' | 'expired'

function pollStatus(poll: PollSummary): Status {
  if (poll.closed_at) return 'closed'
  if (new Date(poll.deadline).getTime() < Date.now()) return 'expired'
  return 'active'
}

function StatusBadge({ status }: { status: Status }) {
  const cfg =
    status === 'active'  ? { label: 'Активен',   color: 'var(--color-green)',  bg: 'color-mix(in oklab, var(--color-green) 12%, transparent)'  }
  : status === 'closed'  ? { label: 'Закрыт',    color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' }
  :                        { label: 'Просрочен', color: 'var(--color-warn)',   bg: 'color-mix(in oklab, var(--color-warn) 12%, transparent)'   }
  return (
    <span
      className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}
    >
      {cfg.label}
    </span>
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

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
