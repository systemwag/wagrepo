'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCw } from 'lucide-react'

export default function DailyRefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      title="Обновить"
      aria-label="Обновить"
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all
                 hover-surface disabled:opacity-60"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      <RotateCw size={13} className={pending ? 'animate-spin' : ''} />
      Обновить
    </button>
  )
}
