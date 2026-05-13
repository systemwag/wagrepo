'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Рендерит детей в document.body, минуя любые `transform`/`willChange` на
 * ancestor-ах (например, обёртку PullToRefresh), которые ломают `position: fixed`.
 *
 * lockScroll — блокирует прокрутку фона, пока компонент смонтирован. По умолчанию true
 * (подходит для полноэкранных диалогов). Для дропдаунов передавать false.
 */
export function Portal({ children, lockScroll = true }: { children: React.ReactNode; lockScroll?: boolean }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!lockScroll) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [lockScroll])

  if (!mounted) return null
  return createPortal(children, document.body)
}
