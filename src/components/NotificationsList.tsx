'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, FolderOpen, ClipboardList, Info, CalendarDays } from 'lucide-react'

type Notification = {
  id: string
  user_id: string
  title: string
  message: string
  type: 'project' | 'task' | 'system' | 'event' | string
  linked_id: string | null
  is_read: boolean
  created_at: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  project: { label: 'Проект',      icon: <FolderOpen size={12} />,    color: 'var(--green)' },
  task:    { label: 'Задача',      icon: <ClipboardList size={12} />, color: '#60a5fa' },
  event:   { label: 'Мероприятие', icon: <CalendarDays size={12} />,  color: '#a78bfa' },
  system:  { label: 'Система',     icon: <Info size={12} />,          color: 'var(--text-dim)' },
}

export default function NotificationsList({
  initialNotifications,
  userId,
}: {
  initialNotifications: Notification[]
  userId: string
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  // Realtime subscription
  useEffect(() => {
    const supabase = supabaseRef.current

    const channel = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new as Notification, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev =>
              prev.map(n => n.id === (payload.new as Notification).id ? payload.new as Notification : n)
            )
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const unreadCount = notifications.filter(n => !n.is_read).length
  const displayed = tab === 'unread' ? notifications.filter(n => !n.is_read) : notifications

  async function markAsRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await supabaseRef.current.from('notifications').update({ is_read: true }).eq('id', id)
  }

  async function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabaseRef.current
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
  }

  function handleClick(n: Notification) {
    markAsRead(n.id)
    if (n.type === 'project' && n.linked_id) {
      router.push(`/dashboard/projects/${n.linked_id}`)
    } else if (n.type === 'task') {
      router.push('/dashboard/tasks')
    } else if (n.type === 'event') {
      router.push('/dashboard/events')
    }
  }

  return (
    <div>
      {/* Шапка с табами и кнопкой */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setTab('all')}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === 'all' ? 'var(--green-glow)' : 'transparent',
              color: tab === 'all' ? 'var(--green)' : 'var(--text-muted)',
              border: tab === 'all' ? '1px solid rgba(34,197,94,0.25)' : '1px solid transparent',
            }}
          >
            Все
          </button>
          <button
            onClick={() => setTab('unread')}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={{
              background: tab === 'unread' ? 'var(--green-glow)' : 'transparent',
              color: tab === 'unread' ? 'var(--green)' : 'var(--text-muted)',
              border: tab === 'unread' ? '1px solid rgba(34,197,94,0.25)' : '1px solid transparent',
            }}
          >
            Непрочитанные
            {unreadCount > 0 && (
              <span
                className="flex items-center justify-center rounded-full text-[10px] font-bold text-black"
                style={{ background: 'var(--green)', minWidth: '18px', height: '18px', padding: '0 4px' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={{
              color: 'var(--green)',
              background: 'var(--green-glow)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            <CheckCheck size={15} />
            Прочитать все
          </button>
        )}
      </div>

      {/* Список */}
      {displayed.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Bell size={36} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
          <p className="mt-3 text-sm" style={{ color: 'var(--text-dim)' }}>
            {tab === 'unread' ? 'Нет непрочитанных уведомлений' : 'Нет уведомлений'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayed.map(n => {
            const typeInfo = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system
            const isClickable = n.type === 'project' || n.type === 'task' || n.type === 'event'

            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className="p-4 rounded-2xl flex gap-4 transition-colors"
                style={{
                  background: n.is_read ? 'var(--surface)' : 'var(--green-glow)',
                  border: `1px solid ${n.is_read ? 'var(--border)' : 'rgba(34,197,94,0.2)'}`,
                  cursor: isClickable ? 'pointer' : 'default',
                }}
              >
                {/* Левый цветной индикатор */}
                <div className="flex-shrink-0 mt-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: n.is_read ? 'var(--border-2)' : 'var(--green)',
                      boxShadow: n.is_read ? 'none' : '0 0 8px rgba(34,197,94,0.5)',
                    }}
                  />
                </div>

                {/* Контент */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--text)' }}>
                      {n.title}
                    </p>
                    {/* Тип */}
                    <span
                      className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                      style={{
                        color: typeInfo.color,
                        background: `${typeInfo.color}14`,
                        border: `1px solid ${typeInfo.color}30`,
                      }}
                    >
                      {typeInfo.icon}
                      {typeInfo.label}
                    </span>
                  </div>
                  <p className="text-sm leading-snug" style={{ color: n.is_read ? 'var(--text-muted)' : 'var(--text)' }}>
                    {n.message}
                  </p>
                  <p className="text-[11px] mt-2" style={{ color: 'var(--text-dim)' }}>
                    {new Date(n.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Oral',
                      day: '2-digit',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
