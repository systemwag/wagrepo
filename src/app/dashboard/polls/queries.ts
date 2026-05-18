import type { SupabaseClient } from '@supabase/supabase-js'
import type { PollStatusFilter } from './constants'

// ─────────────────────────────────────────────────────────────────────────────
// Запросы для журнала опросов. Не в 'use server' — это серверные хелперы,
// вызываемые из server components, supabase-клиент уже валидирован.
// ─────────────────────────────────────────────────────────────────────────────

export type PollSummary = {
  id: string
  question: string
  type: 'single_choice' | 'multiple_choice' | 'text'
  audience: 'all' | 'specific'
  deadline: string
  closed_at: string | null
  created_at: string
  created_by: string
  author: { id: string; full_name: string } | null
  response_count: number
  /** Размер аудитории (Y в «X из Y»). Для 'all' — активные сотрудники минус автор. */
  audience_size: number
}

export type AddressedPoll = PollSummary

const POLL_SELECT = `
  id, question, type, audience, deadline, closed_at, created_at, created_by,
  author:profiles!polls_created_by_fkey(id, full_name)
`

/** Опросы, на которые я ещё не ответил и могу ответить (активные, в моей аудитории). */
export async function queryPollsAddressedToMe(
  supabase: SupabaseClient, userId: string,
): Promise<AddressedPoll[]> {
  const nowIso = new Date().toISOString()

  // RLS уже фильтрует видимость, но мы дополнительно отсеиваем мои собственные опросы,
  // закрытые и просроченные — на стороне БД.
  const { data: polls } = await supabase
    .from('polls')
    .select(POLL_SELECT)
    .neq('created_by', userId)
    .is('closed_at', null)
    .gt('deadline', nowIso)
    .order('deadline', { ascending: true })

  if (!polls || polls.length === 0) return []

  // Отфильтровать те, на которые я уже ответил.
  const ids = polls.map(p => (p as { id: string }).id)
  const { data: myResponses } = await supabase
    .from('poll_responses')
    .select('poll_id')
    .eq('user_id', userId)
    .in('poll_id', ids)
  const answered = new Set((myResponses ?? []).map(r => (r as { poll_id: string }).poll_id))

  return polls
    .filter(p => !answered.has((p as { id: string }).id))
    .map(row => {
      const r = row as Record<string, unknown>
      const a = r.author
      const author = Array.isArray(a) ? (a[0] as AddressedPoll['author']) ?? null : (a as AddressedPoll['author'])
      return { ...r, author, response_count: 0, audience_size: 0 } as AddressedPoll
    })
}

/** Опросы, которые я опубликовал — страница с фильтром по статусу. */
export async function queryMyPollsPage(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  pageSize: number,
  status: PollStatusFilter = 'all',
): Promise<PollSummary[]> {
  const from = page * pageSize
  const to   = from + pageSize - 1
  const nowIso = new Date().toISOString()

  let q = supabase
    .from('polls')
    .select(POLL_SELECT)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status === 'active') {
    q = q.is('closed_at', null).gt('deadline', nowIso)
  } else if (status === 'closed') {
    q = q.not('closed_at', 'is', null)
  } else if (status === 'expired') {
    q = q.is('closed_at', null).lte('deadline', nowIso)
  }

  const { data: polls } = await q
  if (!polls || polls.length === 0) return []

  const ids = polls.map(p => (p as { id: string }).id)

  // Параллельно: счётчики ответов, счётчики таргетов и общее число активных
  // (для audience='all'). Один пул запросов, без N+1.
  const hasAllAudience = polls.some(p => (p as Record<string, unknown>).audience === 'all')
  const [
    { data: responses },
    { data: targets },
    { count: activeProfilesCount },
  ] = await Promise.all([
    supabase.from('poll_responses').select('poll_id').in('poll_id', ids),
    supabase.from('poll_targets').select('poll_id').in('poll_id', ids),
    hasAllAudience
      ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true)
      : Promise.resolve({ count: 0 }),
  ])

  const responseCount = new Map<string, number>()
  for (const r of responses ?? []) {
    const pid = (r as { poll_id: string }).poll_id
    responseCount.set(pid, (responseCount.get(pid) ?? 0) + 1)
  }
  const targetCount = new Map<string, number>()
  for (const t of targets ?? []) {
    const pid = (t as { poll_id: string }).poll_id
    targetCount.set(pid, (targetCount.get(pid) ?? 0) + 1)
  }
  const allAudienceSize = Math.max(0, (activeProfilesCount ?? 0) - 1) // минус автор

  return polls.map(row => {
    const r = row as Record<string, unknown>
    const a = r.author
    const author = Array.isArray(a) ? (a[0] as PollSummary['author']) ?? null : (a as PollSummary['author'])
    const id = r.id as string
    const audience_size = r.audience === 'all' ? allAudienceSize : (targetCount.get(id) ?? 0)
    return { ...r, author, response_count: responseCount.get(id) ?? 0, audience_size } as PollSummary
  })
}
