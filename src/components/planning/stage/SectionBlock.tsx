import type { ReactNode } from 'react'

/**
 * Переиспользуемая обёртка-секция для блоков внутри раскрытого этапа:
 * заголовок (иконка + название) + опциональный счётчик справа + контент.
 */
export default function SectionBlock({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode
  title: string
  count?: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: 'var(--text-dim)' }}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          {title}
        </span>
        {count && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}
