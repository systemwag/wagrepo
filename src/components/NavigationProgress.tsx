'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const START_DELAY_MS = 150
const TICK_MS = 80
const ASYMPTOTE = 80
const FADE_OUT_MS = 220

export default function NavigationProgress() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTick() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
  }
  function clearStartDelay() {
    if (startDelayRef.current) { clearTimeout(startDelayRef.current); startDelayRef.current = null }
  }
  function clearFade() {
    if (fadeRef.current) { clearTimeout(fadeRef.current); fadeRef.current = null }
  }

  const begin = useCallback(() => {
    clearFade()
    setActive(true)
    setProgress(8)
    tickRef.current = setInterval(() => {
      setProgress(p => p + (ASYMPTOTE - p) * 0.08)
    }, TICK_MS)
  }, [])

  const finish = useCallback(() => {
    clearTick()
    clearStartDelay()
    setProgress(100)
    fadeRef.current = setTimeout(() => {
      setActive(false)
      setProgress(0)
    }, FADE_OUT_MS)
  }, [])

  // Глобальный перехват клика по <a> с внутренним href — старт через 150 мс,
  // чтобы быстрые навигации (<150 мс) не флешили бар.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const link = target?.closest('a')
      if (!link) return
      const href = link.getAttribute('href')
      if (!href) return
      if (href.startsWith('http') || href.startsWith('//') || href.startsWith('#')) return
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (link.target === '_blank') return
      // Та же страница — навигации не будет
      const targetPath = href.split('?')[0].split('#')[0]
      if (targetPath === pathname) return

      clearStartDelay()
      startDelayRef.current = setTimeout(begin, START_DELAY_MS)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [pathname, begin])

  // Завершение при изменении pathname / search — навигация дошла до контента
  useEffect(() => {
    clearStartDelay()
    if (active) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search?.toString(), finish])

  // Cleanup при unmount
  useEffect(() => () => { clearTick(); clearStartDelay(); clearFade() }, [])

  if (!active) return null
  return (
    <div
      className="nav-progress"
      aria-hidden
      style={{ width: `${Math.min(progress, 100)}%` }}
    />
  )
}
