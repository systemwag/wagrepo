'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Невидимый компонент, который подписывается на новые ответы конкретного опроса
 * и триггерит router.refresh(). Используется автором/директором/админом, чтобы
 * результаты «Х из Y» и список «не ответили» обновлялись live, без F5.
 */
export default function PollRealtimeRefresher({ pollId }: { pollId: string }) {
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    const channel = supabase
      .channel(`poll-responses-${pollId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'poll_responses',
          filter: `poll_id=eq.${pollId}`,
        },
        () => { router.refresh() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [pollId, router])

  return null
}
