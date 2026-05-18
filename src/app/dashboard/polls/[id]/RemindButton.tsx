'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Loader2, Check } from 'lucide-react'
import { remindNotResponded } from '@/lib/actions/polls'

export default function RemindButton({ pollId, count }: { pollId: string; count: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function handleClick() {
    startTransition(async () => {
      const res = await remindNotResponded(pollId)
      if (res.error) {
        alert(res.error)
        return
      }
      setDone(true)
      setTimeout(() => setDone(false), 3000)
      router.refresh()
    })
  }

  if (done) {
    return (
      <span
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium"
        style={{
          background: 'color-mix(in oklab, var(--color-green) 12%, transparent)',
          color: 'var(--color-green)',
          border: '1px solid color-mix(in oklab, var(--color-green) 25%, transparent)',
        }}
      >
        <Check size={14} />
        Отправлено
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
      style={{
        background: 'color-mix(in oklab, var(--color-warn) 10%, transparent)',
        color: 'var(--color-warn)',
        borderColor: 'color-mix(in oklab, var(--color-warn) 30%, transparent)',
      }}
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
      Напомнить всем {count > 0 && <span className="num">({count})</span>}
    </button>
  )
}
