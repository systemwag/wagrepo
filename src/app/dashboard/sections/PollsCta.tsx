import Link from 'next/link'
import { MessageCircleQuestion } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * Промптит пользователя ответить на опросы, адресованные ему. Если неотвеченных
 * нет — виджет не рендерится вовсе.
 *
 * Активным считается опрос с closed_at IS NULL и deadline > NOW(). RLS отсекает
 * не-мои аудитории, повторно ничего фильтровать не нужно.
 */
export default async function PollsCta({ userId }: { userId: string }) {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  const { data: polls } = await supabase
    .from('polls')
    .select('id')
    .neq('created_by', userId)
    .is('closed_at', null)
    .gt('deadline', nowIso)
  if (!polls || polls.length === 0) return null

  const ids = polls.map(p => (p as { id: string }).id)
  const { data: myResponses } = await supabase
    .from('poll_responses')
    .select('poll_id')
    .eq('user_id', userId)
    .in('poll_id', ids)
  const answered = new Set((myResponses ?? []).map(r => (r as { poll_id: string }).poll_id))
  const pending = polls.filter(p => !answered.has((p as { id: string }).id))
  if (pending.length === 0) return null

  return (
    <Link
      href="/dashboard/polls"
      className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors"
      style={{
        background: 'color-mix(in oklab, var(--color-info) 8%, transparent)',
        borderColor: 'color-mix(in oklab, var(--color-info) 25%, transparent)',
        color: 'var(--color-info)',
      }}
    >
      <MessageCircleQuestion size={16} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {pending.length === 1 ? 'Ответьте на опрос' : `Вам адресовано ${pending.length} опросов`}
        </p>
        <p className="text-xs opacity-80 truncate">Без ответа — будет видно автору</p>
      </div>
      <span className="text-xs">→</span>
    </Link>
  )
}
