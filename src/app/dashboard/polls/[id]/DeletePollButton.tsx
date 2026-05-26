'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { deletePoll } from '@/lib/actions/polls'
import { useToast } from '@/components/ui/Toast'

export default function DeletePollButton({ pollId, responseCount = 0 }: { pollId: string; responseCount?: number }) {
  const router = useRouter()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const res = await deletePoll(pollId)
      if (res.error) {
        toast.show('error', res.error)
        setConfirming(false)
        return
      }
      toast.show('success', 'Опрос удалён')
      router.push('/dashboard/polls')
      router.refresh()
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors w-full sm:w-auto"
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

  const confirmText = responseCount > 0
    ? `Удалить опрос вместе с ${responseCount} ${plural(responseCount, 'ответом', 'ответами', 'ответами')}? Откатить нельзя.`
    : 'Удалить опрос? Ответов нет, откатить нельзя.'

  return (
    <div className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-xl border w-full sm:w-auto" style={{
      background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
      borderColor: 'color-mix(in oklab, var(--color-danger) 25%, transparent)',
    }}>
      <span className="text-xs text-danger flex-1 min-w-0">{confirmText}</span>
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

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
