'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Signals = {
  unread: number
  overdueDirect: number
  overdueProject: number
  pendingPolls: number
}

type NotificationRow = { id: string; is_read: boolean }

/**
 * Источник сигналов для мобильной навигации:
 *   • unread          — непрочитанные уведомления
 *   • overdueDirect   — просроченные поручения сотрудника
 *   • overdueProject  — просроченные задачи в проектах
 *   • pendingPolls    — опросы, на которые я ещё не ответил
 *
 * Realtime: notifications (unread), direct_tasks/project_tasks (overdue —
 * re-fetch по debounce, потому что overdue считается по дедлайну + статусу,
 * а это вычислимо только запросом). Polls — refetch по debounce, как overdue.
 */
export function useMobileNavSignals(userId: string): Signals {
  const [signals, setSignals] = useState<Signals>({ unread: 0, overdueDirect: 0, overdueProject: 0, pendingPolls: 0 })
  const supabaseRef = useRef(createClient())
  const overdueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = supabaseRef.current
    let active = true

    async function fetchUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      if (active && typeof count === 'number') {
        setSignals(s => ({ ...s, unread: count }))
      }
    }

    async function fetchOverdue() {
      const { data } = await supabase.rpc('get_my_overdue_counts', { p_user_id: userId })
      if (!active) return
      let direct = 0, project = 0
      for (const row of (data ?? []) as { kind: 'direct' | 'project'; count: number }[]) {
        if (row.kind === 'direct')  direct  = row.count
        if (row.kind === 'project') project = row.count
      }
      setSignals(s => ({ ...s, overdueDirect: direct, overdueProject: project }))
    }

    function scheduleOverdueRefetch() {
      if (overdueTimerRef.current) clearTimeout(overdueTimerRef.current)
      overdueTimerRef.current = setTimeout(fetchOverdue, 400)
    }

    async function fetchPendingPolls() {
      const nowIso = new Date().toISOString()
      const { data: polls } = await supabase
        .from('polls')
        .select('id')
        .neq('created_by', userId)
        .is('closed_at', null)
        .gt('deadline', nowIso)
      if (!active) return
      if (!polls || polls.length === 0) {
        setSignals(s => ({ ...s, pendingPolls: 0 }))
        return
      }
      const ids = polls.map(p => (p as { id: string }).id)
      const { data: responses } = await supabase
        .from('poll_responses')
        .select('poll_id')
        .eq('user_id', userId)
        .in('poll_id', ids)
      if (!active) return
      const answered = new Set((responses ?? []).map(r => (r as { poll_id: string }).poll_id))
      setSignals(s => ({ ...s, pendingPolls: ids.filter(id => !answered.has(id)).length }))
    }
    function schedulePollsRefetch() {
      if (pollsTimerRef.current) clearTimeout(pollsTimerRef.current)
      pollsTimerRef.current = setTimeout(fetchPendingPolls, 400)
    }

    fetchUnread()
    fetchOverdue()
    fetchPendingPolls()

    const notifChannel = supabase
      .channel(`mobile-nav-notif-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as NotificationRow
            if (!row.is_read) setSignals(s => ({ ...s, unread: s.unread + 1 }))
          } else if (payload.eventType === 'UPDATE') {
            const before = payload.old as NotificationRow
            const after  = payload.new as NotificationRow
            if (before.is_read && !after.is_read) setSignals(s => ({ ...s, unread: s.unread + 1 }))
            else if (!before.is_read && after.is_read) setSignals(s => ({ ...s, unread: Math.max(0, s.unread - 1) }))
          } else if (payload.eventType === 'DELETE') {
            const before = payload.old as NotificationRow
            if (!before.is_read) setSignals(s => ({ ...s, unread: Math.max(0, s.unread - 1) }))
          }
        }
      )
      .subscribe()

    const directChannel = supabase
      .channel(`mobile-nav-direct-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'direct_tasks', filter: `assignee_id=eq.${userId}` },
        scheduleOverdueRefetch
      )
      .subscribe()

    const projectChannel = supabase
      .channel(`mobile-nav-project-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_tasks', filter: `assignee_id=eq.${userId}` },
        scheduleOverdueRefetch
      )
      .subscribe()

    const pollsChannel = supabase
      .channel(`mobile-nav-polls-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, schedulePollsRefetch)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_responses', filter: `user_id=eq.${userId}` },
        schedulePollsRefetch,
      )
      .subscribe()

    return () => {
      active = false
      if (overdueTimerRef.current) clearTimeout(overdueTimerRef.current)
      if (pollsTimerRef.current) clearTimeout(pollsTimerRef.current)
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(directChannel)
      supabase.removeChannel(projectChannel)
      supabase.removeChannel(pollsChannel)
    }
  }, [userId])

  return signals
}
