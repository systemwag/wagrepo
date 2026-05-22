import Link from 'next/link'
import { Sun, History } from 'lucide-react'

type View = 'today' | 'history'

const TABS: { key: View; label: string; href: string; icon: React.ReactNode }[] = [
  { key: 'today',   label: 'Сегодня',  href: '/dashboard/daily/team',                icon: <Sun size={14} /> },
  { key: 'history', label: 'История',  href: '/dashboard/daily/team?view=history',   icon: <History size={14} /> },
]

export default function DailyViewTabs({ current }: { current: View }) {
  return (
    <div
      className="mb-5 grid grid-cols-2 md:inline-flex gap-1 p-1 rounded-xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {TABS.map(tab => {
        const active = tab.key === current
        return (
          <Link
            key={tab.key}
            href={tab.href}
            replace
            scroll={false}
            data-active={active}
            className="inline-flex items-center justify-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-sm font-medium
                       transition-all
                       data-[active=false]:text-text-dim
                       data-[active=false]:hover:text-text
                       data-[active=true]:text-[color:var(--color-green)]
                       data-[active=true]:bg-[color:color-mix(in_oklab,var(--color-green)_15%,transparent)]
                       data-[active=true]:border-[color:color-mix(in_oklab,var(--color-green)_25%,transparent)]"
            style={{
              border: active
                ? '1px solid color-mix(in oklab, var(--color-green) 25%, transparent)'
                : '1px solid transparent',
            }}
          >
            {tab.icon}
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
