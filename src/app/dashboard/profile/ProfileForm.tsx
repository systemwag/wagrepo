'use client'

import { useState } from 'react'
import { Check, Loader2, Mail } from 'lucide-react'
import { updateMyProfile, changeMyEmail } from '@/lib/actions/profile'

type Props = {
  initial: {
    full_name:  string
    position:   string
    department: string
    phone:      string
    birth_date: string
  }
  email: string
}

export default function ProfileForm({ initial, email }: Props) {
  const [fullName,   setFullName]   = useState(initial.full_name)
  const [position,   setPosition]   = useState(initial.position)
  const [department, setDepartment] = useState(initial.department)
  const [phone,      setPhone]      = useState(initial.phone)
  const [birthDate,  setBirthDate]  = useState(initial.birth_date)
  const [error,      setError]      = useState('')
  const [saved,      setSaved]      = useState(false)
  const [loading,    setLoading]    = useState(false)

  // Смена email — отдельный flow с подтверждением по ссылке
  const [newEmail, setNewEmail] = useState('')
  const [emailEditing, setEmailEditing] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const dirty =
    fullName   !== initial.full_name  ||
    position   !== initial.position   ||
    department !== initial.department ||
    phone      !== initial.phone      ||
    birthDate  !== initial.birth_date

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaved(false); setLoading(true)
    const res = await updateMyProfile({
      full_name:  fullName.trim(),
      position:   position.trim() || null,
      department: department.trim() || null,
      phone:      phone.trim() || null,
      birth_date: birthDate.trim() || null,
    })
    setLoading(false)
    if (res.error) {
      setError(res.error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function handleEmailChange() {
    if (!newEmail.trim()) return
    setEmailLoading(true)
    setEmailMessage(null)
    const res = await changeMyEmail(newEmail)
    setEmailLoading(false)
    if (res.error) {
      setEmailMessage({ type: 'error', text: res.error })
      return
    }
    setEmailMessage({ type: 'success', text: 'Email обновлён. Используйте новый адрес при следующем входе.' })
    setEmailEditing(false)
    setNewEmail('')
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-text">ФИО</label>
        <input
          type="text"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Фамилия Имя Отчество"
          className="input w-full"
          autoComplete="name"
          maxLength={200}
        />
      </div>

      {/* Email — логин в систему, меняется через подтверждение по ссылке */}
      <div>
        <label className="block text-sm font-medium mb-1.5 text-text">Email</label>
        {!emailEditing ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div
              className="flex-1 px-3 py-2 rounded-lg text-sm text-text-muted truncate min-w-0"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            >
              {email}
            </div>
            <button
              type="button"
              onClick={() => { setEmailEditing(true); setNewEmail(email); setEmailMessage(null) }}
              className="px-3 py-2 rounded-lg text-sm font-medium hover-surface w-full sm:w-auto"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              Изменить
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="new@example.com"
              className="input w-full"
              autoComplete="email"
              maxLength={254}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEmailChange}
                disabled={emailLoading || !newEmail.trim() || newEmail.trim().toLowerCase() === email.toLowerCase()}
                className="btn-green inline-flex items-center gap-2 text-sm"
              >
                {emailLoading && <Loader2 size={14} className="animate-spin" />}
                <Mail size={14} />
                {emailLoading ? 'Сохраняем…' : 'Сохранить email'}
              </button>
              <button
                type="button"
                onClick={() => { setEmailEditing(false); setNewEmail(''); setEmailMessage(null) }}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Отмена
              </button>
            </div>
          </div>
        )}
        {emailMessage && (
          <p
            className="text-xs mt-2 px-2.5 py-2 rounded-lg"
            style={
              emailMessage.type === 'success'
                ? { background: 'var(--color-green-glow)', color: 'var(--color-green)', border: '1px solid color-mix(in oklab, var(--color-green) 25%, transparent)' }
                : { background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)' }
            }
          >
            {emailMessage.text}
          </p>
        )}
        {!emailEditing && !emailMessage && (
          <p className="text-xs text-text-dim mt-1">Логин в систему</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-text">Должность</label>
        <input
          type="text"
          value={position}
          onChange={e => setPosition(e.target.value)}
          placeholder="Например: инженер ПТО"
          className="input w-full"
          maxLength={100}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-text">Отдел</label>
        <input
          type="text"
          value={department}
          onChange={e => setDepartment(e.target.value)}
          placeholder="Например: строительство"
          className="input w-full"
          maxLength={100}
        />
      </div>

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
