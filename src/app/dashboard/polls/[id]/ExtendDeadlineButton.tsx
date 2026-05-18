'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Loader2, X } from 'lucide-react'
import { extendPollDeadline } from '@/lib/actions/polls'
import DatePicker from '@/components/ui/DatePicker'

export default function ExtendDeadlineButton({ pollId }: { pollId: string }) {
  const router = useRouter()
  const [open, setOpen]   = useState(false)
  const [date, setDate]   = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (!date) { setError('Выберите дату'); return }
    setError(null)
    startTransition(async () => {
      const res = await extendPollDeadline(pollId, date)
      if (res.error) { setError(res.error); return }
      setOpen(false)
      setDate('')
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors"
        style={{
          background: 'color-mix(in oklab, var(--color-info) 10%, transparent)',
          color: 'var(--color-info)',
          borderColor: 'color-mix(in oklab, var(--color-info) 30%, transparent)',
        }}
      >
        <CalendarClock size={14} />
        Продлить дедлайн
      </button>
    )
  }

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border"
      style={{
        background: 'color-mix(in oklab, var(--color-info) 8%, transparent)',
        borderColor: 'color-mix(in oklab, var(--color-info) 25%, transparent)',
      }}
    >
      <span className="text-xs text-info">До какой даты?</span>
      <div className="w-44">
        <DatePicker value={date} onChange={setDate} placeholder="Новая дата" />
      </div>
      <button
        onClick={handleSave}
        disabled={pending}
        className="px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
        style={{ background: 'var(--color-info)', color: '#fff' }}
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <CalendarClock size={11} />}
        Продлить
      </button>
      <button
        onClick={() => { setOpen(false); setDate(''); setError(null) }}
        className="px-2 py-1 rounded-md text-xs text-text-muted hover-text"
        aria-label="Отмена"
      >
        <X size={11} />
      </button>
      {error && <span className="text-xs text-danger ml-2">{error}</span>}
    </div>
  )
}
