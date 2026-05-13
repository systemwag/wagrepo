'use client'

import Link, { LinkProps } from 'next/link'
import { useRouter } from 'next/navigation'
import { ReactNode, MouseEvent } from 'react'

type Props = LinkProps & {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  prefetch?: boolean
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Link с поддержкой CSS View Transitions API.
 *
 * Если браузер поддерживает `document.startViewTransition`, переход
 * на новую страницу будет плавно анимирован средствами браузера.
 * Элементы с одинаковым `view-transition-name` морфятся друг в друга.
 *
 * Если API нет (Safari < 18, старые Firefox) — обычный переход без анимации.
 */
export function TransitionLink({ children, onClick, ...props }: Props) {
  const router = useRouter()

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return

    // Обычные модификаторы (Cmd-клик и т.п.) — пускаем браузер
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (typeof props.href !== 'string') return

    // Если API нет — обычный переход через Next router
    type DocWithVT = Document & { startViewTransition?: (cb: () => void) => unknown }
    const doc = document as DocWithVT
    if (typeof doc.startViewTransition !== 'function') return

    e.preventDefault()
    doc.startViewTransition(() => {
      router.push(props.href as string)
    })
  }

  return <Link {...props} onClick={handleClick}>{children}</Link>
}
