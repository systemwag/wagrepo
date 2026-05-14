'use client'

import { useEffect, useState } from 'react'
import { Send, CheckCircle2, AlertCircle, BellOff } from 'lucide-react'
import { sendTestPushToSelf, type TestPushResult } from '@/lib/actions/push'

/**
 * Admin-only диагностический инструмент: отправляет себе тестовый push,
 * показывает на сколько устройств доставлено.
 *
 * Сам проверяет, есть ли активная подписка на этом устройстве. Если её нет —
 * показывает подсказку, а не молчит.
 */
export default function PushTestPanel() {
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestPushResult | null>(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (typeof window === 'undefined') return
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setSubscribed(false)
        return
      }
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled) setSubscribed(!!sub)
      } catch {
        if (!cancelled) setSubscribed(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  async function send() {
    setTesting(true); setResult(null)
    const r = await sendTestPushToSelf()
    setResult(r)
    setTesting(false)
  }

  if (subscribed === null) return null

  if (!subscribed) {
    return (
      <div
        className="p-4 rounded-2xl flex items-start gap-3"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
        >
          <BellOff size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Push не подключен на этом устройстве</p>
          <p className="text-xs text-text-muted mt-0.5">
            Зайди на <code className="text-text">/dashboard/notifications</code> и включи там подписку,
            чтобы можно было отправить тестовое уведомление.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="p-4 rounded-2xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'color-mix(in oklab, var(--color-green) 15%, transparent)',
            color: 'var(--color-green)',
          }}
        >
          <Send size={18} strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-text">Тестовый push</p>
          <p className="text-xs text-text-muted mt-0.5">
            Отправляет уведомление на все ваши активные устройства. Проверка доставки и Service Worker.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={send}
        disabled={testing}
        className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg border disabled:opacity-50"
        style={{
          background: 'var(--color-surface-2)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
        }}
      >
        <Send size={13} strokeWidth={1.8} />
        {testing ? 'Отправляем…' : 'Отправить тестовое уведомление'}
      </button>

      {result && (
        <div
          className="mt-3 flex items-start gap-2 text-xs px-3 py-2 rounded-lg"
          style={{
            background: result.ok
              ? 'color-mix(in oklab, var(--color-green) 8%, transparent)'
              : 'color-mix(in oklab, var(--color-warn) 8%, transparent)',
            border: `1px solid ${result.ok ? 'color-mix(in oklab, var(--color-green) 25%, transparent)' : 'color-mix(in oklab, var(--color-warn) 25%, transparent)'}`,
            color: result.ok ? 'var(--color-green)' : 'var(--color-warn)',
          }}
        >
          {result.ok
            ? <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
            : <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />}
          <span>
            {result.ok
              ? `Отправлено на ${result.sent} из ${result.total} устройств. Если не пришло — проверьте Focus Assist / системные уведомления.`
              : result.error || 'Не удалось отправить'}
          </span>
        </div>
      )}
    </div>
  )
}
