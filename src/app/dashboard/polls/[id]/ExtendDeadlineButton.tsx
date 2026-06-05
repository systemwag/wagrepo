'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Loader2, X } from 'lucide-react'
import { extendPollDeadline } from '@/lib/actions/polls'
import DatePicker from '@/components/ui/DatePicker'
import { Portal } from '@/components/ui/Portal'
import { useIsMobile } from '@/lib/hooks/useMediaQuery'
import { useToast } from '@/components/ui/Toast'

export default function ExtendDeadlineButton({ pollId }: { pollId: string }) {
  const router = useRouter()
  const toast = useToast()
  const isMobile = useIsMobile()
  const [open, setOpen]   = useState(false)
  const [date, setDate]   = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const closeSheet = useCallback(() => {
    setOpen(false)
    setDate('')
    setError(null)
  }, [])

  // Закрытие по Escape (только для bottom-sheet версии)
  useEffect(() => {
    if (!open || !isMobile) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeSheet() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isMobile, closeSheet])

  function handleSave() {
    if (!date) { setError('Выберите дату'); return }
    setError(null)
    startTransition(async () => {
      const res = await extendPollDeadline(pollId, date)
      if (res.error) {
        setError(res.error)
        toast.show('error', res.error)
        return
      }
      toast.show('success', 'Дедлайн продлён')
      closeSheet()
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors w-full sm:w-auto"
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

  // ── Мобильный bottom-sheet ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <Portal>
        <div
          className="fixed inset-0 z-[100]"
          style={{ background: 'color-mix(in oklab, black 60%, transparent)' }}
          onClick={closeSheet}
          aria-hidden
        />
        <div
          className="fixed left-0 right-0 bottom-0 z-[101] rounded-t-2xl p-5"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderBottom: 'none',
            paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
            boxShadow: '0 -16px 48px rgba(0,0,0,0.65)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Продлить дедлайн опроса"
        >
          <div className="mx-auto w-10 h-1 rounded-full mb-4" style={{ background: 'var(--color-border-2)' }} />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text inline-flex items-center gap-2">
              <CalendarClock size={16} className="text-info" />
              Продлить дедлайн
            </h3>
            <button
              type="button"
              onClick={closeSheet}
              className="p-2 -m-2 rounded-lg hover-surface text-text-muted"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-text-muted mb-3">До какой даты принимать ответы?</p>
          <DatePicker value={date} onChange={setDate} placeholder="Новая дата" accentColor="var(--color-info)" />
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
          <button
            onClick={handleSave}
            disabled={pending}
            className="mt-4 w-full px-4 py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--color-info)', color: '#fff' }}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
            Продлить
          </button>
        </div>
      </Portal>
    )
  }

  // ── Десктоп: inline-форма ────────────────────────────────────────────────
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
        onClick={closeSheet}
        className="px-2 py-1 rounded-md text-xs text-text-muted hover-text"
        aria-label="Отмена"
      >
        <X size={11} />
      </button>
      {error && <span className="text-xs text-danger ml-2">{error}</span>}
    </div>
  )
}
