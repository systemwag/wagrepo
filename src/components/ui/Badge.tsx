import { ReactNode } from 'react'

export type BadgeTone =
  | 'green'   // успех, активно, выполнено
  | 'info'    // в работе, информация
  | 'warn'    // на проверке, внимание
  | 'danger'  // просрочка, ошибка
  | 'purple'  // спец-статус
  | 'neutral' // без акцента

const TONES: Record<BadgeTone, { bg: string; color: string; border: string }> = {
  green: {
    bg:     'color-mix(in oklab, var(--color-green) 15%, transparent)',
    color:  'var(--color-green)',
    border: 'color-mix(in oklab, var(--color-green) 25%, transparent)',
  },
  info: {
    bg:     'color-mix(in oklab, var(--color-info) 12%, transparent)',
    color:  'var(--color-info)',
    border: 'color-mix(in oklab, var(--color-info) 25%, transparent)',
  },
  warn: {
    bg:     'color-mix(in oklab, var(--color-warn) 12%, transparent)',
    color:  'var(--color-warn)',
    border: 'color-mix(in oklab, var(--color-warn) 25%, transparent)',
  },
  danger: {
    bg:     'color-mix(in oklab, var(--color-danger) 12%, transparent)',
    color:  'var(--color-danger)',
    border: 'color-mix(in oklab, var(--color-danger) 30%, transparent)',
  },
  purple: {
    bg:     'color-mix(in oklab, var(--color-purple) 12%, transparent)',
    color:  'var(--color-purple)',
    border: 'color-mix(in oklab, var(--color-purple) 25%, transparent)',
  },
  neutral: {
    bg:     'var(--color-surface-2)',
    color:  'var(--color-text-muted)',
    border: 'var(--color-border-2)',
  },
}

type BadgeProps = {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
  size?: 'sm' | 'md'
  rounded?: 'pill' | 'lg'
  className?: string
}

export function Badge({ tone = 'neutral', icon, children, size = 'sm', rounded = 'lg', className = '' }: BadgeProps) {
  const t = TONES[tone]
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
  const radius = rounded === 'pill' ? 'rounded-full' : 'rounded-lg'

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold border ${padding} ${radius} ${className}`}
      style={{
        background: t.bg,
        color: t.color,
        borderColor: t.border,
        transition: 'background-color 220ms ease, color 220ms ease, border-color 220ms ease',
      }}
    >
      {icon}
      {children}
    </span>
  )
}

/** Variant: jumbo solid badge — для «Сегодня 🎂» и подобных «kicker»-меток */
export function BadgeSolid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${className}`}
      style={{ background: 'var(--color-green)', color: '#0a0f0a' }}
    >
      {children}
    </span>
  )
}
