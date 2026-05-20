'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type NotificationRow = { id: string; is_read: boolean }

/**
 * Зелёный индикатор с числом непрочитанных уведомлений + пульсация.
 * Встраивается в пункт «Уведомления» в Sidebar — занимает мало места,
 * подписан на realtime, при шторме обновлений не дёргается.
 *
 * setAppBadge синхронизируется с системной иконкой PWA (Android Chrome,
 * iOS 16.4+ standalone, macOS Dock).
 */
export default function NotificationDot({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    let active = true

    async function fetchUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      if (active && typeof count === 'number') setUnread(count)
    }
    fetchUnread()

    const channel = supabase
      .channel(`notifications-dot-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as NotificationRow
            if (!row.is_read) setUnread(n => n + 1)
          } else if (payload.eventType === 'UPDATE') {
            const before = payload.old as NotificationRow
            const after  = payload.new as NotificationRow
            if (before.is_read && !after.is_read) setUnread(n => n + 1)
            else if (!before.is_read && after.is_read) setUnread(n => Math.max(0, n - 1))
          } else if (payload.eventType === 'DELETE') {
            const before = payload.old as NotificationRow
            if (!before.is_read) setUnread(n => Math.max(0, n - 1))
          }
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Системный бейдж иконки PWA — на платформах, которые это поддерживают.
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    type BadgeNav = Navigator & {
      setAppBadge?:   (count?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    const nav: BadgeNav = navigator
    if (!nav.setAppBadge || !nav.clearAppBadge) return
    if (unread > 0) nav.setAppBadge(unread).catch(() => {})
    else nav.clearAppBadge().catch(() => {})
  }, [unread])

  if (unread <= 0) return null

  return (
    <span
      className="inline-flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[10px] font-bold animate-green-pulse"
      style={{ background: 'var(--green)', color: '#040d07' }}
      aria-label={`${unread} непрочитанных уведомлений`}
    >
      {unread > 9 ? '9+' : unread}
    </span>
  )
}
