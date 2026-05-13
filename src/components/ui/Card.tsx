import { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
  accent?: boolean
  as?: 'div' | 'article' | 'section'
}

export function Card({ children, className = '', accent, as: Tag = 'div' }: CardProps) {
  return (
    <Tag
      className={`bg-surface border rounded-[14px] @container ${className}`}
      style={{
        borderColor: accent ? 'color-mix(in oklab, var(--color-green) 30%, transparent)' : 'var(--color-border)',
      }}
    >
      {children}
    </Tag>
  )
}

type CardHeaderProps = {
  icon?: ReactNode
  iconColor?: string
  title: string
  count?: number
  countTone?: 'green' | 'warn' | 'info' | 'danger' | 'neutral'
  action?: ReactNode
}

const COUNT_TONE: Record<NonNullable<CardHeaderProps['countTone']>, { bg: string; color: string; border: string }> = {
  green: {
    bg:     'color-mix(in oklab, var(--color-green) 15%, transparent)',
    color:  'var(--color-green)',
    border: 'color-mix(in oklab, var(--color-green) 25%, transparent)',
  },
  warn: {
    bg:     'color-mix(in oklab, var(--color-warn) 15%, transparent)',
    color:  'var(--color-warn)',
    border: 'color-mix(in oklab, var(--color-warn) 30%, transparent)',
  },
  info: {
    bg:     'color-mix(in oklab, var(--color-info) 12%, transparent)',
    color:  'var(--color-info)',
    border: 'color-mix(in oklab, var(--color-info) 25%, transparent)',
  },
  danger: {
    bg:     'color-mix(in oklab, var(--color-danger) 12%, transparent)',
    color:  'var(--color-danger)',
    border: 'color-mix(in oklab, var(--color-danger) 30%, transparent)',
  },
  neutral: {
    bg:     'var(--color-surface-2)',
    color:  'var(--color-text-muted)',
    border: 'var(--color-border-2)',
  },
}

export function CardHeader({ icon, iconColor = 'var(--color-green)', title, count, countTone = 'green', action }: CardHeaderProps) {
  const tone = COUNT_TONE[countTone]
  return (
    <div className="flex items-center gap-3 px-4 py-3 @md:px-6 @md:py-4 border-b border-border">
      {icon && <span className="shrink-0" style={{ color: iconColor }}>{icon}</span>}
      <h2 className="font-semibold text-text">{title}</h2>
      {count !== undefined && count > 0 && (
        <span
          className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border num"
          style={{ background: tone.bg, color: tone.color, borderColor: tone.border }}
        >
          {count}
        </span>
      )}
      {action && <div className={count !== undefined && count > 0 ? 'ml-2' : 'ml-auto'}>{action}</div>}
    </div>
  )
}

export function CardEmpty({ icon, text, compact }: { icon: ReactNode; text: string; compact?: boolean }) {
  // V4 / V5: компактный режим — одна строка вместо большого блока с иконкой по центру.
  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-4 @md:px-6 text-text-muted">
        <span className="opacity-40 shrink-0">{icon}</span>
        <p className="text-sm">{text}</p>
      </div>
    )
  }
  return (
    <div className="px-4 py-8 flex flex-col items-center gap-3 text-text-muted">
      <span className="opacity-20">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  )
}
