'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { updateMyProfile } from '@/lib/actions/profile'

type Props = {
  initial: { phone: string; birth_date: string }
  fullName:   string
  email:      string
  position:   string
  department: string
}

export default function ProfileForm({ initial, fullName, email, position, department }: Props) {
  const [phone,      setPhone]      = useState(initial.phone)
  const [birthDate,  setBirthDate]  = useState(initial.birth_date)
  const [error,      setError]      = useState('')
  const [saved,      setSaved]      = useState(false)
  const [loading,    setLoading]    = useState(false)

  const dirty = phone !== initial.phone || birthDate !== initial.birth_date

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaved(false); setLoading(true)
    const res = await updateMyProfile({
      phone:      phone.trim() || null,
      birth_date: birthDate.trim() || null,
    })
    setLoading(false)
    if (res.error) {
      setError(res.error)
    } else {
      setSaved(true)
      // Скрываем «сохранено» через 2 сек
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Read-only поля */}
      <ReadOnlyField label="ФИО"      value={fullName}   hint="Изменяет директор" />
      <ReadOnlyField label="Email"    value={email}      hint="Логин в систему" />
      <ReadOnlyField label="Должность" value={position || '—'} hint="Изменяет директор" />
      <ReadOnlyField label="Отдел"    value={department || '—'} hint="Изменяет директор" />

      {/* Редактируемые */}
      <div>
        <label className="block text-sm font-medium mb-1.5 text-text">Телефон</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+7XXXXXXXXXX"
          className="input w-full"
          autoComplete="tel"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-text">Дата рождения</label>
        <input
          type="date"
          value={birthDate}
          onChange={e => setBirthDate(e.target.value)}
          className="input w-full"
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

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
          disabled={!dirty || loading}
          className="btn-green inline-flex items-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Сохранение…' : 'Сохранить'}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green">
            <Check size={14} /> Сохранено
          </span>
        )}
      </div>
    </form>
  )
}

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-text-muted">{label}</label>
      <div
        className="px-3 py-2 rounded-lg text-sm text-text-muted"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
      >
        {value}
      </div>
      {hint && <p className="text-xs text-text-dim mt-1">{hint}</p>}
    </div>
  )
}
