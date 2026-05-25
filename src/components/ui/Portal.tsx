'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

/**
 * Рендерит детей в document.body, минуя любые `transform`/`willChange` на
 * ancestor-ах (например, обёртку PullToRefresh), которые ломают `position: fixed`.
 *
 * lockScroll — блокирует прокрутку фона, пока компонент смонтирован. По умолчанию true
 * (подходит для полноэкранных диалогов). Для дропдаунов передавать false.
 */
export function Portal({ children, lockScroll = true }: { children: React.ReactNode; lockScroll?: boolean }) {
  // SSR-safe «am I on client». useSyncExternalStore возвращает true только
  // после гидратации — без setState в эффекте (правило react-hooks/set-state-in-effect).
  const mounted = useSyncExternalStore(subscribeNoop, getSnapshotClient, getSnapshotServer)

  useEffect(() => {
    if (!lockScroll) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [lockScroll])

  if (!mounted) return null
  return createPortal(children, document.body)
}

// ── Подписка-заглушка для useSyncExternalStore: внешнего стора нет, нам нужен
//    только разный snapshot на сервере (false) и клиенте (true).
function subscribeNoop() { return () => {} }
function getSnapshotClient() { return true }
function getSnapshotServer() { return false }
