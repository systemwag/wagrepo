'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, FolderOpen, ClipboardList, Info, CalendarDays, Send, MessageSquare, MessageCircleQuestion, Trash2, ChevronDown, Eraser } from 'lucide-react'

type Notification = {
  id: string
  user_id: string
  title: string
  message: string
  type: 'project' | 'direct_task' | 'direct_task_feedback' | 'project_task' | 'task' | 'system' | 'event' | 'poll' | string
  linked_id: string | null
  is_read: boolean
  created_at: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  project:              { label: 'Проект',      icon: <FolderOpen size={12} />,    color: 'var(--green)' },
  direct_task:          { label: 'Поручение',   icon: <Send size={12} />,          color: 'var(--color-warn)' },
  direct_task_feedback: { label: 'Ответ',       icon: <MessageSquare size={12} />, color: '#f59e0b' },
  project_task:         { label: 'Задача',      icon: <ClipboardList size={12} />, color: '#60a5fa' },
  task:                 { label: 'Задача',      icon: <ClipboardList size={12} />, color: '#60a5fa' }, // legacy
  event:                { label: 'Мероприятие', icon: <CalendarDays size={12} />,  color: '#a78bfa' },
  poll:                 { label: 'Опрос',       icon: <MessageCircleQuestion size={12} />, color: '#22d3ee' },
  system:               { label: 'Система',     icon: <Info size={12} />,          color: 'var(--text-dim)' },
}

const CLICKABLE_TYPES = new Set(['project', 'project_task', 'direct_task', 'direct_task_feedback', 'task', 'event', 'poll'])

// Группа — это идущие подряд уведомления про одну сущность (type + linked_id).
// Уведомления без linked_id (system) не группируются: ключ берёт их id.
type Group = { key: string; items: Notification[] }

function buildGroups(list: Notification[]): Group[] {
  const groups: Group[] = []
  for (const n of list) {
    const entityKey = n.linked_id ? `${n.type}::${n.linked_id}` : `solo::${n.id}`
    const last = groups[groups.length - 1]
    if (last && last.key === entityKey) {
      last.items.push(n)
    } else {
      groups.push({ key: entityKey, items: [n] })
    }
  }
  return groups
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
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
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
            const incoming = payload.new as Notification
            // Идемпотентность: realtime может догнать уже добавленное оптимистично
            setNotifications(prev => prev.some(n => n.id === incoming.id) ? prev : [incoming, ...prev])
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
  const readCount = notifications.length - unreadCount

  // Типы, реально присутствующие в списке — для чипов фильтра
  const presentTypes = useMemo(() => {
    const set = new Set<string>()
    for (const n of notifications) set.add(TYPE_CONFIG[n.type] ? n.type : 'system')
    return Array.from(set)
  }, [notifications])

  const displayed = useMemo(() => {
    let list = tab === 'unread' ? notifications.filter(n => !n.is_read) : notifications
    if (typeFilter !== 'all') list = list.filter(n => (TYPE_CONFIG[n.type] ? n.type : 'system') === typeFilter)
    return list
  }, [notifications, tab, typeFilter])

  const groups = useMemo(() => buildGroups(displayed), [displayed])

  async function markAsRead(ids: string[]) {
    if (ids.length === 0) return
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n))
    await supabaseRef.current.from('notifications').update({ is_read: true }).in('id', ids)
  }

  async function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabaseRef.current
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
  }

  async function dismiss(ids: string[]) {
    if (ids.length === 0) return
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)))
    // RLS notifications_delete (user_id = auth.uid()) — пользователь сносит только своё
    await supabaseRef.current.from('notifications').delete().in('id', ids)
  }

  async function clearRead() {
    const readIds = notifications.filter(n => n.is_read).map(n => n.id)
    if (readIds.length === 0) return
    setNotifications(prev => prev.filter(n => !n.is_read))
    await supabaseRef.current.from('notifications').delete().eq('user_id', userId).eq('is_read', true)
  }

  function navigate(n: Notification) {
    if (n.type === 'project' && n.linked_id) {
      router.push(`/dashboard/projects/${n.linked_id}`)
    } else if (n.type === 'project_task' && n.linked_id) {
      router.push(`/dashboard/projects/${n.linked_id}`)
    } else if (n.type === 'direct_task_feedback') {
      router.push('/dashboard/assign')
    } else if (n.type === 'direct_task' || n.type === 'task') {
      router.push('/dashboard/assignments')
    } else if (n.type === 'event') {
      router.push('/dashboard/events')
    } else if (n.type === 'poll' && n.linked_id) {
      router.push(`/dashboard/polls/${n.linked_id}`)
    }
  }

  function handleGroupClick(group: Group) {
    const head = group.items[0]
    markAsRead(group.items.filter(n => !n.is_read).map(n => n.id))
    if (CLICKABLE_TYPES.has(head.type)) navigate(head)
  }

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString('ru-RU', {
      timeZone: 'Asia/Oral', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div>
      {/* Шапка с табами и кнопками */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
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

        <div className="flex items-center gap-2">
          {readCount > 0 && (
            <button
              onClick={clearRead}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
              style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
              title="Удалить все прочитанные"
            >
              <Eraser size={15} />
              <span className="hidden sm:inline">Очистить прочитанные</span>
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
              style={{ color: 'var(--green)', background: 'var(--green-glow)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <CheckCheck size={15} />
              <span className="hidden sm:inline">Прочитать все</span>
            </button>
          )}
        </div>
      </div>

      {/* Фильтр по типу */}
      {presentTypes.length > 1 && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
          <FilterChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} color="var(--text-muted)">
            Все типы
          </FilterChip>
          {presentTypes.map(t => {
            const cfg = TYPE_CONFIG[t] ?? TYPE_CONFIG.system
            return (
              <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} color={cfg.color}>
                <span className="inline-flex items-center gap-1">{cfg.icon}{cfg.label}</span>
              </FilterChip>
            )
          })}
        </div>
      )}

      {/* Список */}
      {groups.length === 0 ? (
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
          {groups.map(group => {
            const head = group.items[0]
            const extra = group.items.length - 1
            const typeInfo = TYPE_CONFIG[head.type] ?? TYPE_CONFIG.system
            const groupUnread = group.items.some(n => !n.is_read)
            const isClickable = CLICKABLE_TYPES.has(head.type)
            const isOpen = expanded.has(group.key)

            return (
              <div
                key={group.key}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: groupUnread ? 'var(--green-glow)' : 'var(--surface)',
                  border: `1px solid ${groupUnread ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                }}
              >
                {/* Заголовок группы (последнее уведомление) */}
                <div
                  onClick={() => handleGroupClick(group)}
                  className="p-4 flex gap-4 transition-colors"
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                >
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: groupUnread ? 'var(--green)' : 'var(--border-2)',
                        boxShadow: groupUnread ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--text)' }}>
                        {head.title}
                      </p>
                      <span
                        className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                        style={{ color: typeInfo.color, background: `${typeInfo.color}14`, border: `1px solid ${typeInfo.color}30` }}
                      >
                        {typeInfo.icon}
                        {typeInfo.label}
                      </span>
                    </div>
                    <p className="text-sm leading-snug" style={{ color: groupUnread ? 'var(--text)' : 'var(--text-muted)' }}>
                      {head.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{fmt(head.created_at)}</p>
                      {extra > 0 && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); toggleExpand(group.key) }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium"
                          style={{ color: 'var(--green)' }}
                        >
                          <ChevronDown size={12} className="transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                          ещё {extra}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Удалить группу */}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); dismiss(group.items.map(n => n.id)) }}
                    aria-label="Удалить"
                    className="flex-shrink-0 self-start p-1.5 rounded-lg text-text-dim hover-surface"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Развёрнутые остальные уведомления группы */}
                {isOpen && extra > 0 && (
                  <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                    {group.items.slice(1).map(n => (
                      <div
                        key={n.id}
                        onClick={() => { markAsRead(n.is_read ? [] : [n.id]); if (isClickable) navigate(n) }}
                        className="px-4 py-3 flex gap-4 border-t first:border-t-0"
                        style={{ borderColor: 'var(--border)', cursor: isClickable ? 'pointer' : 'default' }}
                      >
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: n.is_read ? 'var(--border-2)' : 'var(--green)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug" style={{ color: n.is_read ? 'var(--text-muted)' : 'var(--text)' }}>{n.message}</p>
                          <p className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>{fmt(n.created_at)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); dismiss([n.id]) }}
                          aria-label="Удалить"
                          className="flex-shrink-0 self-start p-1.5 rounded-lg text-text-dim hover-surface"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  active, onClick, color, children,
}: {
  active: boolean
  onClick: () => void
  color: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
      style={{
        color: active ? color : 'var(--text-muted)',
        background: active ? `color-mix(in oklab, ${color} 16%, transparent)` : 'var(--surface)',
        border: `1px solid ${active ? `color-mix(in oklab, ${color} 35%, transparent)` : 'var(--border)'}`,
      }}
    >
      {children}
    </button>
  )
}
