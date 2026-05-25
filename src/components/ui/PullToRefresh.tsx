'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCw } from 'lucide-react'
import { useHaptic } from '@/lib/hooks/useHaptic'

const TRIGGER_DISTANCE = 80
const MAX_DISTANCE     = 130

/**
 * Pull-to-refresh для PWA-режима. На обычной вкладке браузера PTR
 * уже встроен в Chrome/Safari, поэтому хук активируется только когда
 * приложение запущено как standalone (установленное PWA).
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pull, setPull] = useState(0)            // 0..MAX_DISTANCE
  const [refreshing, setRefreshing] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const startY = useRef<number | null>(null)
  const pulling = useRef(false)
  const triggeredHaptic = useRef(false)
  const haptic = useHaptic()

  // Активируем только в PWA-режиме
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setEnabled(!!isStandalone)
  }, [])

  useEffect(() => {
    if (!enabled) return

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 2) return
      startY.current = e.touches[0].clientY
      pulling.current = false
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current == null) return
      if (window.scrollY > 2) { startY.current = null; return }

      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) { setPull(0); return }

      pulling.current = true
      // Резиновое сопротивление: ближе к MAX тянется тяжелее
      const resisted = Math.min(MAX_DISTANCE, Math.pow(delta, 0.85))
      setPull(resisted)

      // Haptic «триггер» в момент достижения порога — ощущение защёлки
      if (resisted >= TRIGGER_DISTANCE && !triggeredHaptic.current) {
        triggeredHaptic.current = true
        haptic.impact()
      } else if (resisted < TRIGGER_DISTANCE && triggeredHaptic.current) {
        triggeredHaptic.current = false
      }

      // Не даём странице скроллиться вверх (rubber-band)
      if (delta > 10) e.preventDefault()
    }

    async function onTouchEnd() {
      if (!pulling.current) { setPull(0); return }
      const finalPull = pull
      startY.current = null
      pulling.current = false
      triggeredHaptic.current = false

      if (finalPull >= TRIGGER_DISTANCE) {
        setRefreshing(true)
        haptic.success()
        try {
          router.refresh()
          await new Promise(r => setTimeout(r, 600))
        } finally {
          setRefreshing(false)
          setPull(0)
        }
      } else {
        setPull(0)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove',  onTouchMove,  { passive: false })
    window.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove',  onTouchMove)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [enabled, pull, router, haptic])

  if (!enabled) return <>{children}</>

  const progress = Math.min(1, pull / TRIGGER_DISTANCE)
  const showIndicator = pull > 4 || refreshing

  return (
    <>
      {/* Индикатор pull-to-refresh */}
      <div
        aria-hidden
        className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none"
        style={{
          top: 'env(safe-area-inset-top, 0px)',
          opacity: showIndicator ? 1 : 0,
          transform: `translateY(${refreshing ? 12 : Math.max(0, pull - 32)}px)`,
          transition: refreshing ? 'transform 200ms ease, opacity 200ms ease' : 'opacity 120ms ease',
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shadow-2xl"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          <RotateCw
            size={18}
            className={refreshing ? 'animate-spin' : ''}
            style={{
              color: progress >= 1 ? 'var(--color-green)' : 'var(--color-text-muted)',
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
              transition: refreshing ? 'color 120ms ease' : 'transform 80ms ease, color 120ms ease',
            }}
          />
        </div>
      </div>

      {/* Контент */}
      <div
        style={{
          transform: refreshing ? 'translateY(48px)' : `translateY(${pull * 0.4}px)`,
          transition: refreshing ? 'transform 200ms ease' : pulling.current ? 'none' : 'transform 220ms cubic-bezier(0.22,1,0.36,1)',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </>
  )
}
