import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Clock, MessageCircleQuestion, CheckCircle2, XCircle, Users, Pencil, UserX, Copy } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatNameShort } from '@/lib/utils/name'
import { hasDirectorAccess } from '@/lib/roles'
import RespondForm from './RespondForm'
import ClosePollButton from './ClosePollButton'
import DeletePollButton from './DeletePollButton'
import PollRealtimeRefresher from './PollRealtimeRefresher'
import RemindButton from './RemindButton'
import ExtendDeadlineButton from './ExtendDeadlineButton'

type PollOption = { id: string; label: string }

type PollRow = {
  id: string
  question: string
  type: 'single_choice' | 'multiple_choice' | 'text'
  options: PollOption[] | null
  audience: 'all' | 'specific'
  deadline: string
  closed_at: string | null
  created_at: string
  created_by: string
  author: { id: string; full_name: string } | null
}

type ResponseRow = {
  user_id: string
  submitted_at: string
  text_answer: string | null
  selected_option_ids: string[] | null
  user: { id: string; full_name: string } | null
}

export default async function PollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const { id } = await params
  const supabase = await createClient()

  // RLS отфильтрует невидимое сам. notFound() — если опрос или нет доступа.
  const { data: rawPoll } = await supabase
    .from('polls')
    .select(`
      id, question, type, options, audience, deadline, closed_at, created_at, created_by,
      author:profiles!polls_created_by_fkey(id, full_name)
    `)
    .eq('id', id)
    .single()
  if (!rawPoll) notFound()

  const poll = normalisePoll(rawPoll)
  const isAuthor   = poll.created_by === profile.id
  const isManager  = hasDirectorAccess(profile.role)
  const canManage  = isAuthor || isManager // редактировать/удалять/закрывать
  const seesResults = canManage              // тех же показываем сводку
  // eslint-disable-next-line react-hooks/purity
  const isExpired = new Date(poll.deadline).getTime() < Date.now()
  const isClosed  = !!poll.closed_at
  const isOpen    = !isClosed && !isExpired

  // Мой собственный ответ — нужен и автору (видит свой), и адресату.
  const { data: myResponseRows } = await supabase
    .from('poll_responses')
    .select('user_id, text_answer, selected_option_ids, submitted_at')
    .eq('poll_id', id)
    .eq('user_id', profile.id)
    .maybeSingle()
  const myResponse = myResponseRows as ResponseRow | null

  // Адресат я или нет: всегда true для audience='all', иначе проверяем targets.
  // Это нужно, потому что директор видит опрос через has_director_access,
  // но в аудитории может не быть — отвечать тогда не должен.
  let isInAudience = poll.audience === 'all'
  if (!isInAudience && !isAuthor) {
    const { data: t } = await supabase
      .from('poll_targets')
      .select('user_id')
      .eq('poll_id', id)
      .eq('user_id', profile.id)
      .maybeSingle()
    isInAudience = !!t
  }

  // Менеджерам и автору загружаем все ответы для статистики +
  // полный список аудитории, чтобы посчитать «кто не ответил».
  let allResponses: ResponseRow[] = []
  let audienceUsers: { id: string; full_name: string }[] = []
  if (seesResults) {
    const [responsesRes, audienceRes] = await Promise.all([
      supabase
        .from('poll_responses')
        .select(`
          user_id, submitted_at, text_answer, selected_option_ids,
          user:profiles!poll_responses_user_id_fkey(id, full_name)
        `)
        .eq('poll_id', id)
        .order('submitted_at', { ascending: false }),
      poll.audience === 'all'
        ? supabase
            .from('profiles')
            .select('id, full_name')
            .eq('is_active', true)
            .neq('id', poll.created_by)
            .order('full_name', { ascending: true })
        : supabase
            .from('poll_targets')
            .select('user:profiles!poll_targets_user_id_fkey(id, full_name)')
            .eq('poll_id', id),
    ])
    allResponses = (responsesRes.data ?? []).map(r => {
      const raw = r as Record<string, unknown>
      const u = raw.user
      const user = Array.isArray(u) ? (u[0] as ResponseRow['user']) ?? null : (u as ResponseRow['user'])
      return { ...(raw as unknown as ResponseRow), user }
    })
    if (poll.audience === 'all') {
      audienceUsers = (audienceRes.data ?? []) as { id: string; full_name: string }[]
    } else {
      audienceUsers = (audienceRes.data ?? [])
        .map(row => {
          const u = (row as Record<string, unknown>).user
          return Array.isArray(u) ? (u[0] as { id: string; full_name: string } | undefined) : (u as { id: string; full_name: string } | null)
        })
        .filter((u): u is { id: string; full_name: string } => !!u)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))
    }
  }
  const respondedIds = new Set(allResponses.map(r => r.user_id))
  const notResponded = audienceUsers.filter(u => !respondedIds.has(u.id))
  const hasResponses = allResponses.length > 0 || !!myResponse
  const canEdit      = canManage && !hasResponses

  return (
    <div>
      <div style={{ viewTransitionName: `poll-card-${id}` } as React.CSSProperties}>
      <PageHeader
        icon={<MessageCircleQuestion size={18} />}
        iconTone="info"
        title={poll.question}
        titleClamp
        subtitle={
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {poll.author && <span>от {formatNameShort(poll.author.full_name)}</span>}
            <span className="inline-flex items-center gap-1">
              <Clock size={11} />
              до {formatDateOral(poll.deadline)}
            </span>
            <StatusBadge isOpen={isOpen} isClosed={isClosed} isExpired={isExpired} />
          </span>
        }
        back={{ href: '/dashboard/polls', label: 'К опросам' }}
        action={canManage ? (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {canEdit && (
              <Link
                href={`/dashboard/polls/${poll.id}/edit`}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors w-full sm:w-auto"
                style={{
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text-muted)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <Pencil size={14} />
                Редактировать
              </Link>
            )}
            <Link
              href={`/dashboard/polls/new?from=${poll.id}`}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors w-full sm:w-auto"
              style={{
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
                borderColor: 'var(--color-border)',
              }}
              title="Создать новый опрос на основе этого"
            >
              <Copy size={14} />
              Дублировать
            </Link>
            {/* Просроченный, но не закрытый — даём продлить дедлайн. */}
            {isExpired && !isClosed && <ExtendDeadlineButton pollId={poll.id} />}
            {isOpen && <ClosePollButton pollId={poll.id} responseCount={allResponses.length} />}
            <DeletePollButton pollId={poll.id} responseCount={allResponses.length} />
          </div>
        ) : null}
      />
      </div>

      <div className="grid gap-4 md:gap-6">
        {/* Адресат — форма ответа или подтверждение. Автор форму не видит
            (отвечать на свой опрос смысла нет). Директор/админ видит и форму
            (если в аудитории) и результаты ниже. */}
        {!isAuthor && isInAudience && (
          myResponse ? (
            <MyResponseCard poll={poll} response={myResponse} isClosed={isClosed} isExpired={isExpired} />
          ) : isOpen ? (
            <Card>
              <CardHeader icon={<MessageCircleQuestion size={18} />} title="Ваш ответ" />
              <div className="p-4 md:p-6">
                <RespondForm poll={poll} />
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-6 flex items-center gap-3 text-text-muted">
                <XCircle size={20} />
                <p className="text-sm">{isClosed ? 'Опрос закрыт' : 'Срок ответа истёк'} — ответы больше не принимаются.</p>
              </div>
            </Card>
          )
        )}

        {/* Автор/директор/админ — статистика, ответы и «не ответили» */}
        {seesResults && (
          <>
            <ResultsBlock
              poll={poll}
              responses={allResponses}
              audienceSize={audienceUsers.length}
              notResponded={notResponded}
              canRemind={isOpen}
            />
            <PollRealtimeRefresher pollId={poll.id} />
          </>
        )}
      </div>
    </div>
  )
}

function normalisePoll(row: unknown): PollRow {
  const r = row as Record<string, unknown>
  const a = r.author
  const author = Array.isArray(a) ? (a[0] as PollRow['author']) ?? null : (a as PollRow['author'])
  return { ...r, author } as PollRow
}

function StatusBadge({ isOpen, isClosed }: { isOpen: boolean; isClosed: boolean; isExpired: boolean }) {
  const cfg = isOpen
    ? { label: 'Активен',   color: 'var(--color-green)',     bg: 'color-mix(in oklab, var(--color-green) 12%, transparent)' }
    : isClosed
    ? { label: 'Закрыт',    color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' }
    : { label: 'Просрочен', color: 'var(--color-warn)',      bg: 'color-mix(in oklab, var(--color-warn) 12%, transparent)' }
  return (
    <span
      className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}
    >
      {cfg.label}
    </span>
  )
}

function MyResponseCard({ poll, response, isClosed, isExpired }: {
  poll: PollRow
  response: ResponseRow
  isClosed: boolean
  isExpired: boolean
}) {
  const stateBadge =
    isClosed  ? { label: 'Опрос закрыт',    color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' }
  : isExpired ? { label: 'Срок ответа истёк', color: 'var(--color-warn)',     bg: 'color-mix(in oklab, var(--color-warn) 12%, transparent)' }
  :             null
  return (
    <Card>
      <CardHeader
        icon={<CheckCircle2 size={18} />}
        title="Вы уже ответили"
        action={stateBadge ? (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
            style={{ color: stateBadge.color, background: stateBadge.bg, border: `1px solid ${stateBadge.color}33` }}
          >
            {stateBadge.label}
          </span>
        ) : undefined}
      />
      <div className="p-4 md:p-6 space-y-3">
        {poll.type === 'text' ? (
          <blockquote
            className="px-4 py-3 rounded-lg text-sm italic"
            style={{ background: 'var(--color-surface-2)', borderLeft: '3px solid var(--color-green)', color: 'var(--color-text)' }}
          >
            «{response.text_answer}»
          </blockquote>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(response.selected_option_ids ?? []).map(oid => {
              const opt = (poll.options ?? []).find(o => o.id === oid)
              return (
                <span key={oid} className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{
                    background: 'color-mix(in oklab, var(--color-green) 12%, transparent)',
                    color: 'var(--color-green)',
                    border: '1px solid color-mix(in oklab, var(--color-green) 25%, transparent)',
                  }}
                >
                  {opt?.label ?? oid}
                </span>
              )
            })}
          </div>
        )}
        <p className="text-xs text-text-dim">Отправлено {formatDateOral(response.submitted_at, true)}.</p>
      </div>
    </Card>
  )
}

function ResultsBlock({ poll, responses, audienceSize, notResponded, canRemind }: {
  poll: PollRow
  responses: ResponseRow[]
  audienceSize: number
  notResponded: { id: string; full_name: string }[]
  canRemind: boolean
}) {
  const total = responses.length
  return (
    <>
      <Card>
        <CardHeader
          icon={<Users size={18} />}
          title={audienceSize > 0 ? `Результаты — ${total} из ${audienceSize}` : 'Результаты'}
          count={audienceSize > 0 ? undefined : total}
          countTone="info"
        />
        <div className="p-4 md:p-6">
          {poll.type === 'text' ? (
            <TextResults responses={responses} />
          ) : (
            <ChoiceResults poll={poll} responses={responses} />
          )}
        </div>
      </Card>

      {responses.length > 0 && (
        <Card>
          <CardHeader icon={<CheckCircle2 size={18} />} title="Кто ответил" count={responses.length} countTone="neutral" />
          <div>
            {responses.map((r, i) => (
              <div
                key={r.user_id}
                className="flex items-start gap-3 px-4 py-3 @md:px-6"
                style={{ borderBottom: i < responses.length - 1 ? '1px solid var(--color-border)' : undefined }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{r.user?.full_name ?? '—'}</p>
                  <p className="text-xs text-text-dim mt-0.5">
                    {formatDateOral(r.submitted_at, true)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {notResponded.length > 0 && (
        <Card>
          <CardHeader
            icon={<UserX size={18} />}
            title="Ещё не ответили"
            count={notResponded.length}
            countTone="warn"
            action={canRemind ? <RemindButton pollId={poll.id} count={notResponded.length} /> : undefined}
          />
          <div className="p-4 md:p-6 flex flex-wrap gap-2">
            {notResponded.map(u => (
              <span
                key={u.id}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm border"
                style={{
                  background: 'color-mix(in oklab, var(--color-warn) 8%, transparent)',
                  borderColor: 'color-mix(in oklab, var(--color-warn) 25%, transparent)',
                  color: 'var(--color-text)',
                }}
              >
                {u.full_name}
              </span>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

function ChoiceResults({ poll, responses }: { poll: PollRow; responses: ResponseRow[] }) {
  const options = poll.options ?? []
  // Подсчёт голосов по опциям.
  const counts = new Map<string, number>()
  for (const r of responses) {
    for (const oid of r.selected_option_ids ?? []) {
      counts.set(oid, (counts.get(oid) ?? 0) + 1)
    }
  }
  // Знаменатель — число ответивших (для percent доли «из ответивших»).
  const total = responses.length || 1

  return (
    <div className="space-y-3">
      {options.map(opt => {
        const n = counts.get(opt.id) ?? 0
        const pct = Math.round((n / total) * 100)
        return (
          <div key={opt.id}>
            <div className="flex items-center justify-between mb-1 text-sm">
              <span className="text-text">{opt.label}</span>
              <span className="text-text-dim tabular-nums">
                {n} ({pct}%)
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
              <div
                className="h-full transition-[width]"
                style={{ width: `${pct}%`, background: 'var(--color-green)' }}
              />
            </div>
          </div>
        )
      })}
      {responses.length === 0 && (
        <p className="text-sm text-text-dim italic">Пока ответов нет.</p>
      )}
    </div>
  )
}

function TextResults({ responses }: { responses: ResponseRow[] }) {
  if (responses.length === 0) {
    return <p className="text-sm text-text-dim italic">Пока ответов нет.</p>
  }
  return (
    <div className="space-y-3">
      {responses.map(r => (
        <div
          key={r.user_id}
          className="px-4 py-3 rounded-lg"
          style={{ background: 'var(--color-surface-2)', borderLeft: '3px solid var(--color-green)' }}
        >
          <p className="text-sm text-text leading-snug">«{r.text_answer}»</p>
          <p className="text-xs text-text-dim mt-1.5">
            {r.user?.full_name ?? '—'} · {formatDateOral(r.submitted_at, true)}
          </p>
        </div>
      ))}
    </div>
  )
}

function formatDateOral(iso: string, withTime = false) {
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Asia/Oral',
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
