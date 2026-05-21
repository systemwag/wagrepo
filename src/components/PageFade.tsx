'use client'

import { usePathname } from 'next/navigation'

/**
 * Лёгкий fade-in на каждой смене pathname через @starting-style.
 * Ключуется на pathname → React переподмонтирует обёртку → CSS-анимация запускается заново.
 */
export function PageFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="page-fade">
      {children}
    </div>
  )
}
