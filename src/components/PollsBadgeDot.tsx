'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Бейдж с числом неотвеченных опросов для пункта «Опросы» в Sidebar.
 * Активный опрос = closed_at IS NULL AND deadline > now() AND not_mine AND
 * нет моего ответа. RLS отсекает невидимое.
 *
 * Realtime: подписка на polls (любое изменение — INSERT/UPDATE/DELETE)
 * и poll_responses (только мои). При шторме событий — мини-debounce 300ms.
 */
export default function PollsBadgeDot({ userId }: { userId: string }) {
  const [count, setCount] = useState(0)
  const supabaseRef = useRef(createClient())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = supabaseRef.current
    let active = true

    async function fetchCount() {
      const nowIso = new Date().toISOString()
      const { data: polls } = await supabase
        .from('polls')
        .select('id')
        .neq('created_by', userId)
        .is('closed_at', null)
        .gt('deadline', nowIso)
      if (!active) return
      if (!polls || polls.length === 0) { setCount(0); return }

      const ids = polls.map(p => (p as { id: string }).id)
      const { data: responses } = await supabase
        .from('poll_responses')
        .select('poll_id')
        .eq('user_id', userId)
        .in('poll_id', ids)
      if (!active) return
      const answered = new Set((responses ?? []).map(r => (r as { poll_id: string }).poll_id))
      setCount(ids.filter(id => !answered.has(id)).length)
    }

    function scheduleFetch() {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(fetchCount, 300)
    }

    fetchCount()

    const channel = supabase
      .channel(`polls-badge-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, scheduleFetch)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_responses', filter: `user_id=eq.${userId}` },
        scheduleFetch,
      )
      .subscribe()

    return () => {
      active = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [userId])

  if (count <= 0) return null

  return (
    <span
      className="inline-flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ background: 'var(--color-warn)', color: '#040d07' }}
      aria-label={`${count} опросов ждут ответа`}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
