'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

export default function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const waitingRef = useRef<ServiceWorker | null>(null)
  const userRequestedRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let intervalId: number | undefined

    function markUpdate(sw: ServiceWorker | null) {
      if (!sw) return
      waitingRef.current = sw
      setUpdateAvailable(true)
    }

    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.update().catch(() => {})
      // На мобильном браузер обычно не делает update-check сразу при открытии PWA.
      intervalId = window.setInterval(() => reg.update().catch(() => {}), 60_000 * 30)

      // SW уже ждёт активации (обновился, пока вкладка была закрыта)
      if (reg.waiting && navigator.serviceWorker.controller) {
        markUpdate(reg.waiting)
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          // Условие navigator.serviceWorker.controller отсекает первичную установку:
          // там нет старого SW и обновлять нечего.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            markUpdate(installing)
          }
        })
      })
    }).catch(err => {
      console.warn('[sw] registration failed:', err)
    })

    // Перезагружаем только если пользователь явно нажал «Обновить».
    // Иначе риск потерять данные в открытой форме.
    let reloaded = false
    function onControllerChange() {
      if (reloaded || !userRequestedRef.current) return
      reloaded = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      if (intervalId) clearInterval(intervalId)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  async function applyUpdate() {
    if (!waitingRef.current) return
    userRequestedRef.current = true
    // Сразу скрываем тост — пользователь не должен видеть «зависший» баннер,
    // пока SW активируется и controllerchange долетит до клиента.
    setUpdateAvailable(false)
    waitingRef.current.postMessage({ type: 'SKIP_WAITING' })
    // Обычно reload произойдёт через onControllerChange. Но если по какой-то причине
    // (несколько открытых вкладок, медленная активация) controllerchange не дойдёт,
    // делаем reload вручную через таймаут — иначе пользователь увидит тост снова при
    // следующем заходе.
    setTimeout(() => {
      if (typeof window !== 'undefined') window.location.reload()
    }, 1500)
  }

  function dismiss() {
    // При следующем заходе SW активируется штатно — апдейт не теряется.
    setUpdateAvailable(false)
  }

  if (!updateAvailable) return null

  return (
    <div
      className="fixed left-4 right-4 md:left-auto md:right-4 md:w-[360px] z-50 animate-fade-up"
      style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      role="status"
      aria-live="polite"
    >
      <div
        className="rounded-[14px] border p-3 flex items-center gap-3"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'color-mix(in oklab, var(--color-green) 30%, transparent)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center"
          style={{
            background: 'color-mix(in oklab, var(--color-green) 15%, transparent)',
            color: 'var(--color-green)',
          }}
        >
          <RefreshCw size={18} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">Доступна новая версия</p>
          <p className="text-xs text-text-muted mt-0.5">Обновите, чтобы применить изменения.</p>
        </div>
        <button
          type="button"
          onClick={applyUpdate}
          className="btn-green text-sm shrink-0"
          style={{ padding: '8px 14px' }}
        >
          Обновить
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Закрыть"
          className="shrink-0 text-text-muted hover-text p-1 rounded"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
