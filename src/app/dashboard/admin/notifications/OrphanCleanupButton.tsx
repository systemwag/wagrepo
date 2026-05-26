'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Wand2, Loader2 } from 'lucide-react'
import { adminCleanupOrphanNotifications } from '@/lib/actions/admin'

export default function OrphanCleanupButton() {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function handle() {
    if (!confirm('Удалить уведомления с битой ссылкой (linked_id указывает на несуществующий объект)?')) return
    setMsg(null)
    startTransition(async () => {
      const r = await adminCleanupOrphanNotifications()
      if (!r.ok) setMsg(r.error ?? 'Не удалось')
      else {
        setMsg(`Удалено: ${r.deleted}`)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-text-muted">{msg}</span>}
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        className="text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-50 transition-colors"
        style={{
          background: 'color-mix(in oklab, var(--color-warn) 10%, transparent)',
          color: 'var(--color-warn)',
          border: '1px solid color-mix(in oklab, var(--color-warn) 25%, transparent)',
        }}
        title="Удалить уведомления, чей linked_id больше не существует"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
        Очистить мёртвые ссылки
      </button>
    </div>
  )
}
