import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type IconTone = 'green' | 'warn' | 'info' | 'danger' | 'purple' | 'default'

const TONE_STYLES: Record<IconTone, { bg: string; color: string; border: string }> = {
  green:   { bg: 'color-mix(in oklab, var(--color-green) 12%, transparent)',  color: 'var(--color-green)',  border: 'color-mix(in oklab, var(--color-green) 25%, transparent)' },
  warn:    { bg: 'color-mix(in oklab, var(--color-warn) 12%, transparent)',   color: 'var(--color-warn)',   border: 'color-mix(in oklab, var(--color-warn) 25%, transparent)' },
  info:    { bg: 'color-mix(in oklab, var(--color-info) 12%, transparent)',   color: 'var(--color-info)',   border: 'color-mix(in oklab, var(--color-info) 25%, transparent)' },
  danger:  { bg: 'color-mix(in oklab, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)', border: 'color-mix(in oklab, var(--color-danger) 25%, transparent)' },
  purple:  { bg: 'color-mix(in oklab, var(--color-purple) 12%, transparent)', color: 'var(--color-purple)', border: 'color-mix(in oklab, var(--color-purple) 25%, transparent)' },
  default: { bg: 'var(--color-surface-2)',                                    color: 'var(--color-text-muted)', border: 'var(--color-border)' },
}

export type PageHeaderProps = {
  title: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  iconTone?: IconTone
  back?: { href: string; label?: string }
  action?: React.ReactNode
}

export function PageHeader({ title, subtitle, icon, iconTone = 'green', back, action }: PageHeaderProps) {
  const tone = TONE_STYLES[iconTone]
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 mb-3 text-sm transition-colors text-text-muted hover-text"
        >
          <ArrowLeft size={14} />
          {back.label ?? 'Назад'}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold text-text leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm mt-1 text-text-muted">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  )
}
