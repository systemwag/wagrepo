'use client'

import { useState } from 'react'
import { Check, Loader2, Eye, EyeOff } from 'lucide-react'
import { changeMyPassword } from '@/lib/actions/profile'

export default function PasswordForm() {
  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext,    setShowNext]    = useState(false)
  const [error,    setError]    = useState('')
  const [saved,    setSaved]    = useState(false)
  const [loading,  setLoading]  = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaved(false)

    if (!current)                        return setError('Введите текущий пароль.')
    if (next.length < 8)                 return setError('Новый пароль должен быть не короче 8 символов.')
    if (next !== confirm)                return setError('Пароли не совпадают.')
    if (next === current)                return setError('Новый пароль совпадает с текущим.')

    setLoading(true)
    const res = await changeMyPassword(current, next)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setSaved(true)
    setCurrent(''); setNext(''); setConfirm('')
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PasswordField
        label="Текущий пароль"
        value={current}
        onChange={setCurrent}
        show={showCurrent}
        onToggle={() => setShowCurrent(s => !s)}
        autoComplete="current-password"
      />
      <PasswordField
        label="Новый пароль"
        value={next}
        onChange={setNext}
        show={showNext}
        onToggle={() => setShowNext(s => !s)}
        autoComplete="new-password"
        hint="Минимум 8 символов"
      />
      <PasswordField
        label="Повтор нового пароля"
        value={confirm}
        onChange={setConfirm}
        show={showNext}
        autoComplete="new-password"
      />

      {error && (
        <div
          className="text-sm px-3 py-2 rounded-lg"
          style={{
            background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
            color:      'var(--color-danger)',
            border:     '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)',
          }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={loading || !current || !next || !confirm}
          className="btn-green inline-flex items-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Смена…' : 'Сменить пароль'}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green">
            <Check size={14} /> Пароль обновлён
          </span>
        )}
      </div>
    </form>
  )
}

function PasswordField({
  label, value, onChange, show, onToggle, autoComplete, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle?: () => void
  autoComplete?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-text">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="input w-full pr-10"
        />
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover-surface text-text-dim hover:text-text"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-text-dim mt-1">{hint}</p>}
    </div>
  )
}
