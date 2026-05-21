'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { Portal } from './Portal'

export type ToastTone = 'success' | 'error' | 'info' | 'warn'

type ToastItem = { id: string; tone: ToastTone; message: string }

type ToastContextValue = {
  show: (tone: ToastTone, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

const AUTO_DISMISS_MS = 3500
const MAX_VISIBLE = 3
const COOKIE_NAME = 'wag_toast'

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const pathname = usePathname()

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((tone: ToastTone, message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev.slice(-(MAX_VISIBLE - 1)), { id, tone, message }])
    window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }, [dismiss])

  // Flash-cookie: читаем на маунте и на каждой смене pathname (после redirect).
  // Откладываем setState в microtask, чтобы не падать на react-hooks/set-state-in-effect.
  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`))
    if (!match) return
    let parsed: { tone: ToastTone; message: string } | null = null
    try {
      parsed = JSON.parse(decodeURIComponent(match[1])) as { tone: ToastTone; message: string }
    } catch {
      // мусор в cookie — просто игнорируем
    }
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
    if (parsed?.message) {
      const tone = parsed.tone
      const message = parsed.message
      queueMicrotask(() => show(tone ?? 'info', message))
    }
  }, [pathname, show])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toasts.length > 0 && (
        <Portal lockScroll={false}>
          <ToastViewport toasts={toasts} onDismiss={dismiss} />
        </Portal>
      )}
    </ToastContext.Provider>
  )
}

// ─── Viewport ────────────────────────────────────────────────────────────────

const TONE_CONFIG: Record<ToastTone, {
  icon: React.ReactNode
  border: string
  bg: string
  iconColor: string
}> = {
  success: {
    icon: <CheckCircle2 size={18} />,
    border: 'color-mix(in oklab, var(--color-green) 35%, transparent)',
    bg: 'color-mix(in oklab, var(--color-green) 10%, var(--color-surface))',
    iconColor: 'var(--color-green)',
  },
  error: {
    icon: <AlertCircle size={18} />,
    border: 'color-mix(in oklab, var(--color-danger) 40%, transparent)',
    bg: 'color-mix(in oklab, var(--color-danger) 10%, var(--color-surface))',
    iconColor: 'var(--color-danger)',
  },
  info: {
    icon: <Info size={18} />,
    border: 'color-mix(in oklab, var(--color-info) 35%, transparent)',
    bg: 'color-mix(in oklab, var(--color-info) 10%, var(--color-surface))',
    iconColor: 'var(--color-info)',
  },
  warn: {
    icon: <AlertTriangle size={18} />,
    border: 'color-mix(in oklab, var(--color-warn) 35%, transparent)',
    bg: 'color-mix(in oklab, var(--color-warn) 10%, var(--color-surface))',
    iconColor: 'var(--color-warn)',
  },
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div
      className="fixed z-[60] flex flex-col-reverse gap-2 pointer-events-none"
      style={{
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        right: '16px',
        left: '16px',
        maxWidth: '380px',
        marginLeft: 'auto',
      }}
    >
      {toasts.map(t => {
        const cfg = TONE_CONFIG[t.tone]
        return (
          <div
            key={t.id}
            role="status"
            className="toast-item pointer-events-auto flex items-start gap-2.5 px-3.5 py-3 rounded-xl border shadow-lg"
            style={{
              background: cfg.bg,
              borderColor: cfg.border,
              boxShadow: '0 12px 28px -8px rgba(0,0,0,0.45)',
            }}
          >
            <span style={{ color: cfg.iconColor, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
            <p className="flex-1 text-sm font-medium text-text leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Закрыть"
              className="shrink-0 text-text-dim hover:text-text transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
