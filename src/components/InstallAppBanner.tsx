'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'

const DISMISS_KEY = 'wag-install-prompt-dismissed-at'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000 // неделя

type Mode = 'hidden' | 'android' | 'ios'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallAppBanner() {
  const [mode, setMode] = useState<Mode>('hidden')
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Уже установлено как PWA — никакого баннера
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_MS) return

    function onBeforeInstallPrompt(e: Event) {
      // Отменяем встроенный Chrome-promotion — покажем свой UI
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
      setMode('android')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    // iOS Safari — определяем по userAgent + признаку Safari (Chrome iOS = WebKit, но
    // beforeinstallprompt в любом случае там не работает, поэтому показываем инструкцию)
    const ua = window.navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua)
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua)
    if (isIOS && isSafari) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('ios')
    }

    function onInstalled() {
      // Браузер сообщил что установка прошла — скрываем
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
      setMode('hidden')
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setMode('hidden')
  }

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    // Что бы пользователь ни выбрал — фиксируем dismiss, иначе будем спамить
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setMode('hidden')
  }

  if (mode === 'hidden') return null

  return (
    <div
      className="mb-4 p-4 rounded-[14px] border flex items-start gap-3 animate-fade-up"
      style={{
        background: 'color-mix(in oklab, var(--color-green) 7%, var(--color-surface))',
        borderColor: 'color-mix(in oklab, var(--color-green) 30%, transparent)',
      }}
      role="region"
      aria-label="Установка приложения"
    >
      <div
        className="shrink-0 w-10 h-10 rounded-[10px] flex items-center justify-center"
        style={{
          background: 'color-mix(in oklab, var(--color-green) 15%, transparent)',
          color: 'var(--color-green)',
        }}
      >
        <Download size={20} strokeWidth={1.8} />
      </div>

      <div className="flex-1 min-w-0">
        {mode === 'android' ? (
          <>
            <p className="font-semibold text-text">Установить приложение</p>
            <p className="text-sm text-text-muted mt-0.5 leading-relaxed">
              Открывайте WAG с главного экрана как обычное приложение — быстрее запуск и корректные уведомления.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={install}
                className="btn-green text-sm"
                style={{ padding: '8px 16px' }}
              >
                Установить
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
          </>
        ) : (
          <>
            <p className="font-semibold text-text">Установите WAG на главный экран</p>
            <p className="text-sm text-text-muted mt-1 leading-relaxed">
              Нажмите{' '}
              <span
                className="inline-flex items-center align-middle mx-1 px-1.5 py-0.5 rounded"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
              >
                <Share size={13} strokeWidth={1.8} />
              </span>{' '}
              в панели Safari, затем{' '}
              <span
                className="inline-flex items-center align-middle mx-1 px-1.5 py-0.5 rounded gap-1 text-xs"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
              >
                <Plus size={12} strokeWidth={2} />
                «На экран „Домой“»
              </span>
              .
            </p>
          </>
        )}
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
