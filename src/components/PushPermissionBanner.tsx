'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { requestPushSubscription } from '@/hooks/usePushSubscription'

const DISMISS_KEY = 'wag-push-prompt-dismissed-at'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000 // неделя

export default function PushPermissionBanner() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  // Notification API и localStorage доступны только на клиенте, поэтому решение
  // о показе принимаем после монтирования.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) return
    // Спрашивать имеет смысл только если пользователь ещё не давал ответа.
    // 'granted' — уже подписан (хук синхронизирует), 'denied' — раздражать запрещено.
    if (Notification.permission !== 'default') return

    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_MS) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true)
  }, [])

  async function enable() {
    setBusy(true)
    const ok = await requestPushSubscription()
    setBusy(false)
    // При отказе или ошибке тоже фиксируем dismiss — иначе будем дёргать на каждом маунте.
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    if (!ok && Notification.permission === 'denied') {
      // Нет смысла когда-либо снова показывать баннер — браузер навсегда заблокировал
    }
    setShow(false)
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="mb-4 p-4 rounded-[14px] border flex items-start gap-3 animate-fade-up"
      style={{
        background: 'color-mix(in oklab, var(--color-green) 7%, var(--color-surface))',
        borderColor: 'color-mix(in oklab, var(--color-green) 30%, transparent)',
      }}
      role="region"
      aria-label="Включение уведомлений"
    >
      <div
        className="shrink-0 w-10 h-10 rounded-[10px] flex items-center justify-center"
        style={{
          background: 'color-mix(in oklab, var(--color-green) 15%, transparent)',
          color: 'var(--color-green)',
        }}
      >
        <Bell size={20} strokeWidth={1.8} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text">Включить уведомления</p>
        <p className="text-sm text-text-muted mt-0.5 leading-relaxed">
          Получайте push о новых задачах, поручениях и событиях — даже когда приложение закрыто.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="btn-green text-sm"
            style={{ padding: '8px 16px' }}
          >
            {busy ? 'Подключение…' : 'Включить'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-sm text-text-muted hover-text px-3 rounded-[10px]"
            style={{ minHeight: 44 }}
          >
            Не сейчас
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Закрыть"
        className="shrink-0 text-text-muted hover-text p-2 -mr-1 -mt-1"
      >
        <X size={18} />
      </button>
    </div>
  )
}
