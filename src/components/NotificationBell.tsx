'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'

type NotificationRow = { id: string; title: string; message: string; type: string; is_read: boolean; created_at: string; linked_id: string | null }

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current

    async function fetchNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifications(data)
    }
    fetchNotifications()

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new as NotificationRow, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as NotificationRow
            setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n))
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setNotifications(prev => prev.filter(n => n.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function markAsRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await supabaseRef.current.from('notifications').update({ is_read: true }).eq('id', id)
  }

  async function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabaseRef.current.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  }

  return (
    <div className="fixed top-4 right-4 md:top-8 md:right-8 z-[60]">
      <button 
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-xl transition-colors focus:outline-none"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: open || unreadCount > 0 ? 'var(--green)' : 'var(--text-dim)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-black" 
            style={{ background: 'var(--green)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[50]" onClick={() => setOpen(false)} />
          <div 
            className="absolute top-full right-0 mt-3 w-80 md:w-96 rounded-2xl shadow-xl overflow-hidden flex flex-col z-[60]"
            style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border-2)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
              maxHeight: '400px'
            }}
          >
            <div className="p-3 border-b flex items-center justify-between z-10" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Уведомления</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs font-medium cursor-pointer" style={{ color: 'var(--green)', opacity: 0.8 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}>
                  Прочитать все
                </button>
              )}
            </div>
            
            <div className="overflow-y-auto flex-1 p-2 space-y-1 z-10 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-xs" style={{ color: 'var(--text-dim)' }}>
                  Нет новых уведомлений
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    className="p-3 rounded-xl flex gap-3 text-sm transition-colors cursor-pointer"
                    style={{ 
                      background: n.is_read ? 'transparent' : 'var(--green-glow)',
                    }}
                    onClick={() => {
                      markAsRead(n.id)
                      if (n.type === 'project' && n.linked_id) {
                        router.push(`/dashboard/projects/${n.linked_id}`)
                        setOpen(false)
                      } else if (n.type === 'task') {
                        router.push('/dashboard/tasks')
                        setOpen(false)
                      } else if (n.type === 'event') {
                        router.push('/dashboard/events')
                        setOpen(false)
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[13px]" style={{ color: 'var(--text)' }}>{n.title}</p>
                      <p className="text-xs mt-1 leading-snug" style={{ color: n.is_read ? 'var(--text-muted)' : 'var(--text)' }}>{n.message}</p>
                      <p className="text-[10px] mt-2" style={{ color: 'var(--text-dim)', opacity: 0.7 }}>
                        {new Date(n.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Oral', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" style={{ background: 'var(--green)' }} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
