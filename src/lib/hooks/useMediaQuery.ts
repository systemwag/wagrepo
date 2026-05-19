'use client'

import { useSyncExternalStore } from 'react'

// Подписка на CSS media-query без побочного setState в useEffect.
// На SSR возвращает false — клиентский renderer пересчитает после гидратации.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', callback)
      return () => mq.removeEventListener('change', callback)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

// Удобный шорткат: телефоны и тач-экраны.
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px), (pointer: coarse)')
}
