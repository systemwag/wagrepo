'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2 } from 'lucide-react'
import { closePoll } from '@/lib/actions/polls'

export default function ClosePollButton({ pollId }: { pollId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleClose() {
    startTransition(async () => {
      const res = await closePoll(pollId)
      if (res.error) {
        alert(res.error)
        setConfirming(false)
        return
      }
      router.refresh()
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors"
        style={{
          background: 'var(--color-surface-2)',
          color: 'var(--color-text-muted)',
          borderColor: 'var(--color-border)',
        }}
      >
        <Lock size={14} />
        Закрыть опрос
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border" style={{
      background: 'color-mix(in oklab, var(--color-warn) 8%, transparent)',
      borderColor: 'color-mix(in oklab, var(--color-warn) 25%, transparent)',
    }}>
      <span className="text-xs text-warn">Закрыть опрос?</span>
      <button
        onClick={handleClose}
        disabled={pending}
        className="px-2 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
        style={{
          background: 'var(--color-warn)',
          color: '#000',
        }}
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
        Закрыть
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="px-2 py-1 rounded-md text-xs text-text-muted hover-text"
      >
        Отмена
      </button>
    </div>
  )
}
