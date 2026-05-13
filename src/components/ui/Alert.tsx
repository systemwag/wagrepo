import { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

type Tone = 'warn' | 'danger' | 'info' | 'green'

const TONE: Record<Tone, { bg: string; border: string; color: string }> = {
  warn: {
    bg:     'color-mix(in oklab, var(--color-warn) 8%, transparent)',
    border: 'color-mix(in oklab, var(--color-warn) 25%, transparent)',
    color:  'var(--color-warn)',
  },
  danger: {
    bg:     'color-mix(in oklab, var(--color-danger) 8%, transparent)',
    border: 'color-mix(in oklab, var(--color-danger) 25%, transparent)',
    color:  'var(--color-danger)',
  },
  info: {
    bg:     'color-mix(in oklab, var(--color-info) 8%, transparent)',
    border: 'color-mix(in oklab, var(--color-info) 25%, transparent)',
    color:  'var(--color-info)',
  },
  green: {
    bg:     'color-mix(in oklab, var(--color-green) 8%, transparent)',
    border: 'color-mix(in oklab, var(--color-green) 25%, transparent)',
    color:  'var(--color-green)',
  },
}

type AlertProps = {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  href?: string
  actionLabel?: string
}

export function Alert({ tone = 'warn', icon, children, href, actionLabel }: AlertProps) {
  const t = TONE[tone]
  const inner = (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors"
      style={{ background: t.bg, borderColor: t.border }}
    >
      <span className="shrink-0" style={{ color: t.color }}>
        {icon ?? <AlertTriangle size={16} />}
      </span>
      <p className="text-sm font-medium" style={{ color: t.color }}>
        {children}
      </p>
      {actionLabel && (
        <span className="ml-auto text-xs" style={{ color: t.color }}>
          {actionLabel} →
        </span>
      )}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
