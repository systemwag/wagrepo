'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { submitPollResponse } from '@/lib/actions/polls'

type PollOption = { id: string; label: string }
type Poll = {
  id: string
  question: string
  type: 'single_choice' | 'multiple_choice' | 'text'
  options: PollOption[] | null
}

export default function RespondForm({ poll }: { poll: Poll }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [text, setText] = useState('')
  const [selectedSingle, setSelectedSingle] = useState<string | null>(null)
  const [selectedMulti, setSelectedMulti]   = useState<Set<string>>(new Set())

  function toggleMulti(id: string) {
    setSelectedMulti(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload: Parameters<typeof submitPollResponse>[0] = { poll_id: poll.id }
    if (poll.type === 'text') {
      const v = text.trim()
      if (!v) { setError('Введите ответ'); return }
      payload.text_answer = v
    } else if (poll.type === 'single_choice') {
      if (!selectedSingle) { setError('Выберите вариант'); return }
      payload.selected_option_ids = [selectedSingle]
    } else {
      if (selectedMulti.size === 0) { setError('Выберите хотя бы один вариант'); return }
      payload.selected_option_ids = Array.from(selectedMulti)
    }

    startTransition(async () => {
      const res = await submitPollResponse(payload)
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {poll.type === 'text' && (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
          maxLength={5000}
          placeholder="Ваш ответ…"
          className="w-full px-4 py-3 rounded-xl border resize-none text-sm focus-ring"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
          required
        />
      )}

      {poll.type === 'single_choice' && (
        <div className="space-y-2">
          {(poll.options ?? []).map(opt => {
            const active = selectedSingle === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedSingle(opt.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-colors"
                style={{
                  background: active ? 'color-mix(in oklab, var(--color-green) 12%, transparent)' : 'var(--color-surface-2)',
                  borderColor: active ? 'color-mix(in oklab, var(--color-green) 30%, transparent)' : 'var(--color-border)',
                  color: active ? 'var(--color-green)' : 'var(--color-text)',
                }}
              >
                <span
                  className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{ borderColor: active ? 'var(--color-green)' : 'var(--color-border-2)' }}
                >
                  {active && <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-green)' }} />}
                </span>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {poll.type === 'multiple_choice' && (
        <div className="space-y-2">
          {(poll.options ?? []).map(opt => {
            const active = selectedMulti.has(opt.id)
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleMulti(opt.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-colors"
                style={{
                  background: active ? 'color-mix(in oklab, var(--color-green) 12%, transparent)' : 'var(--color-surface-2)',
                  borderColor: active ? 'color-mix(in oklab, var(--color-green) 30%, transparent)' : 'var(--color-border)',
                  color: active ? 'var(--color-green)' : 'var(--color-text)',
                }}
              >
                <span
                  className="w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center"
                  style={{ borderColor: active ? 'var(--color-green)' : 'var(--color-border-2)', background: active ? 'var(--color-green)' : 'transparent' }}
                >
                  {active && <Check size={13} style={{ color: '#000' }} />}
                </span>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm" style={{
          background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
          color: 'var(--color-danger)',
          border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)',
        }}>
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: 'var(--color-green)', color: '#000' }}
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Отправить ответ
        </button>
      </div>

      <p className="text-xs text-text-dim text-center">
        Ответ можно отправить только один раз — переотправить нельзя.
      </p>
    </form>
  )
}
