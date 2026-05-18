'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { deletePoll } from '@/lib/actions/polls'

export default function DeletePollButton({ pollId }: { pollId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const res = await deletePoll(pollId)
      if (res.error) {
        alert(res.error)
        setConfirming(false)
        return
      }
      router.push('/dashboard/polls')
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
          color: 'var(--color-danger)',
          borderColor: 'color-mix(in oklab, var(--color-danger) 25%, transparent)',
        }}
      >
        <Trash2 size={14} />
        Удалить
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border" style={{
      background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
      borderColor: 'color-mix(in oklab, var(--color-danger) 25%, transparent)',
    }}>
      <span className="text-xs text-danger">Удалить опрос вместе с ответами?</span>
      <button
        onClick={handleDelete}
        disabled={pending}
        className="px-2 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
        style={{
          background: 'var(--color-danger)',
          color: '#fff',
        }}
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
        Удалить
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
