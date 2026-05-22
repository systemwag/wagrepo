'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Signals = {
  unread: number
  overdueDirect: number
  overdueProject: number
}

type NotificationRow = { id: string; is_read: boolean }

/**
 * Источник сигналов для мобильной навигации:
 *   • unread          — непрочитанные уведомления
 *   • overdueDirect   — просроченные поручения сотрудника
 *   • overdueProject  — просроченные задачи в проектах
 *
 * Realtime: notifications (unread), direct_tasks/project_tasks (overdue —
 * re-fetch по debounce, потому что overdue считается по дедлайну + статусу,
 * а это вычислимо только запросом).
 */
export function useMobileNavSignals(userId: string): Signals {
  const [signals, setSignals] = useState<Signals>({ unread: 0, overdueDirect: 0, overdueProject: 0 })
  const supabaseRef = useRef(createClient())
  const overdueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

    fetchUnread()
    fetchOverdue()

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

    return () => {
      active = false
      if (overdueTimerRef.current) clearTimeout(overdueTimerRef.current)
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(directChannel)
      supabase.removeChannel(projectChannel)
    }
  }, [userId])

  return signals
}
