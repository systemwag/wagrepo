'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, ShieldAlert } from 'lucide-react'
import { requestPushSubscription, unsubscribePush } from '@/hooks/usePushSubscription'

type Status =
  | 'loading'      // первичная проверка
  | 'unsupported'  // браузер не умеет push (старый Safari, iOS не-PWA до 16.4)
  | 'denied'       // пользователь когда-то заблокировал в браузере
  | 'off'          // permission=default или granted, но подписки нет
  | 'on'           // активная подписка

export default function PushToggle() {
  const [status, setStatus] = useState<Status>('loading')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    if (typeof window === 'undefined') return
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setStatus(sub ? 'on' : 'off')
    } catch {
      setStatus('off')
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh() }, [])

  async function enable() {
    setBusy(true)
    await requestPushSubscription()
    setBusy(false)
    refresh()
  }

  async function disable() {
    setBusy(true)
    await unsubscribePush()
    setBusy(false)
    refresh()
  }

  if (status === 'loading' || status === 'unsupported') return null

  if (status === 'denied') {
    return (
      <div
        className="mb-4 p-3 rounded-[14px] border flex items-center gap-3"
        style={{
          background: 'color-mix(in oklab, var(--color-warn) 8%, var(--color-surface))',
          borderColor: 'color-mix(in oklab, var(--color-warn) 30%, transparent)',
        }}
      >
        <div
          className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center"
          style={{
            background: 'color-mix(in oklab, var(--color-warn) 15%, transparent)',
            color: 'var(--color-warn)',
          }}
        >
          <ShieldAlert size={18} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">Уведомления заблокированы</p>
          <p className="text-xs text-text-muted mt-0.5">
            Разрешите их в настройках браузера для этого сайта, затем обновите страницу.
          </p>
        </div>
      </div>
    )
  }

  const isOn = status === 'on'

  return (
    <div
      className="mb-4 p-3 rounded-[14px] border flex items-center gap-3"
      style={{
        background: 'var(--color-surface)',
        borderColor: isOn
          ? 'color-mix(in oklab, var(--color-green) 30%, transparent)'
          : 'var(--color-border)',
      }}
    >
      <div
        className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center"
        style={{
          background: isOn
            ? 'color-mix(in oklab, var(--color-green) 15%, transparent)'
            : 'var(--color-surface-2)',
          color: isOn ? 'var(--color-green)' : 'var(--color-text-muted)',
        }}
      >
        {isOn ? <Bell size={18} strokeWidth={1.8} /> : <BellOff size={18} strokeWidth={1.8} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text">
          Push-уведомления на этом устройстве
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          {isOn ? 'Включены — вы получаете уведомления, даже когда приложение закрыто.' : 'Выключены.'}
        </p>
      </div>
      <button
        type="button"
        onClick={isOn ? disable : enable}
        disabled={busy}
        className={isOn ? 'text-sm text-text-muted hover-text' : 'btn-green text-sm'}
        style={{
          padding: '8px 14px',
          minHeight: 36,
          ...(isOn ? {} : { minWidth: 0 }),
        }}
      >
        {busy ? '…' : isOn ? 'Отключить' : 'Включить'}
      </button>
    </div>
  )
}
