'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, ShieldAlert, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { requestPushSubscription, unsubscribePush } from '@/hooks/usePushSubscription'
import { sendTestPushToSelf, type TestPushResult } from '@/lib/actions/push'

type Status =
  | 'loading'      // первичная проверка
  | 'unsupported'  // браузер не умеет push (старый Safari, iOS не-PWA до 16.4)
  | 'denied'       // пользователь когда-то заблокировал в браузере
  | 'off'          // permission=default или granted, но подписки нет
  | 'on'           // активная подписка

export default function PushToggle() {
  const [status, setStatus] = useState<Status>('loading')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestPushResult | null>(null)

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

  async function sendTest() {
    setTesting(true)
    setTestResult(null)
    const result = await sendTestPushToSelf()
    setTestResult(result)
    setTesting(false)
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
    <div className="mb-4">
      <div
        className="p-3 rounded-[14px] border flex items-center gap-3"
        style={{
          background: 'var(--color-surface)',
          borderColor: isOn
            ? 'color-mix(in oklab, var(--color-green) 30%, transparent)'
            : 'var(--color-border)',
          borderBottomLeftRadius: isOn ? 0 : '14px',
          borderBottomRightRadius: isOn ? 0 : '14px',
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

      {/* Диагностический тест — только когда подписка активна */}
      {isOn && (
        <div
          className="px-3 py-2.5 border border-t-0 rounded-b-[14px] flex items-center gap-3 flex-wrap"
          style={{
            background: 'color-mix(in oklab, var(--color-surface-2) 60%, var(--color-surface))',
            borderColor: 'color-mix(in oklab, var(--color-green) 30%, transparent)',
          }}
        >
          <button
            type="button"
            onClick={sendTest}
            disabled={testing}
            className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            <Send size={13} strokeWidth={1.8} />
            {testing ? 'Отправляем…' : 'Отправить тестовое уведомление'}
          </button>

          {testResult && (
            <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
              {testResult.ok ? (
                <CheckCircle2 size={14} style={{ color: 'var(--color-green)' }} />
              ) : (
                <AlertCircle size={14} style={{ color: 'var(--color-warn)' }} />
              )}
              <span className="text-text">
                {testResult.ok
                  ? `Отправлено на ${testResult.sent} из ${testResult.total} устройств. Если не пришло — проверьте Focus Assist / системные уведомления.`
                  : testResult.error || 'Не удалось отправить'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Подробности результата теста — собираем endpoint host'ы */}
      {testResult && testResult.details.length > 0 && (
        <details className="mt-2 text-xs text-text-muted">
          <summary className="cursor-pointer hover-text">Подробности отправки</summary>
          <ul className="mt-2 space-y-1 pl-4">
            {testResult.details.map((d, i) => (
              <li key={i} className="font-mono" style={{ fontSize: 11 }}>
                {d.ok ? '✓' : '✗'} {d.endpointHost}
                {!d.ok && d.status ? ` — ${d.status}` : ''}
                {!d.ok && d.error ? ` — ${d.error.slice(0, 80)}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
