import { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  title: string
  hint?: ReactNode
  action?: ReactNode
  /**
   * 'full' — крупный блок для пустой страницы (карточка, 80×80 иконка, центр).
   * 'inline' — компактный блок для пустой секции внутри Card (40×40 иконка, меньше отступов).
   */
  size?: 'full' | 'inline'
  className?: string
}

export function EmptyState({ icon, title, hint, action, size = 'full', className = '' }: Props) {
  if (size === 'inline') {
    return (
      <div className={`flex flex-col items-center text-center px-4 py-8 ${className}`}>
        <div
          className="relative w-12 h-12 rounded-xl flex items-center justify-center mb-3"
          style={{
            background: 'color-mix(in oklab, var(--color-green) 8%, transparent)',
            border: '1px solid color-mix(in oklab, var(--color-green) 18%, transparent)',
          }}
        >
          <span className="text-text-muted">{icon}</span>
        </div>
        <p className="text-sm font-medium text-text">{title}</p>
        {hint && <p className="text-xs mt-1 text-text-dim leading-relaxed max-w-xs">{hint}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    )
  }

  return (
    <div className={`card flex flex-col items-center justify-center text-center px-6 py-14 md:py-20 max-w-xl mx-auto ${className}`}>
      <div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: 'color-mix(in oklab, var(--color-green) 8%, transparent)',
          border: '1px solid color-mix(in oklab, var(--color-green) 18%, transparent)',
        }}
      >
        <span
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-50"
          style={{
            background: 'radial-gradient(circle at 30% 20%, #E8C56730, transparent 70%)',
          }}
        />
        <span className="text-text-muted relative">{icon}</span>
      </div>

      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {hint && <p className="text-sm mt-2 text-text-muted max-w-md leading-relaxed">{hint}</p>}
      {action && <div className="mt-6 flex items-center gap-3 flex-wrap justify-center">{action}</div>}
    </div>
  )
}
