'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { adminWipeAll } from '@/lib/actions/admin'

export default function WipeAllButton() {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [phrase, setPhrase]           = useState('')
  const [busy, startTransition]       = useTransition()
  const [error, setError]             = useState<string | null>(null)
  const [result, setResult]           = useState<Record<string, number> | null>(null)

  function reset() {
    setConfirmOpen(false); setPhrase(''); setError(null); setResult(null)
  }

  function runWipe() {
    setError(null); setResult(null)
    startTransition(async () => {
      const r = await adminWipeAll()
      if (!r.ok) {
        setError(r.error ?? 'Не удалось очистить')
        setResult(r.deleted)
        return
      }
      setResult(r.deleted)
      setPhrase('')
      router.refresh()
    })
  }

  return (
    <div>
      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2"
          style={{
            background: 'color-mix(in oklab, var(--color-danger) 12%, transparent)',
            color: 'var(--color-danger)',
            border: '1px solid color-mix(in oklab, var(--color-danger) 35%, transparent)',
          }}
        >
          <Trash2 size={14} />
          Очистить ВСЁ рабочее
        </button>
      ) : (
        <div
          className="card p-4 max-w-xl"
          style={{
            borderColor: 'color-mix(in oklab, var(--color-danger) 40%, transparent)',
            background: 'color-mix(in oklab, var(--color-danger) 5%, var(--color-surface))',
          }}
        >
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--color-danger)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text">Полная очистка рабочих данных</p>
              <p className="text-xs mt-1 text-text-muted leading-relaxed">
                Будут удалены: <strong>проекты</strong> (с этапами/задачами по каскаду), <strong>прямые поручения</strong>,
                <strong> события</strong>, <strong>уведомления</strong>, <strong>дейли-отчёты</strong>, <strong>документы</strong>.
                <br />
                <span className="text-text-dim">Останутся:</span> пользователи, шаблоны проектов, push-подписки, лог активности.
                <br />
                <span style={{ color: 'var(--color-danger)' }} className="font-semibold">Действие необратимо.</span>
              </p>
            </div>
            <button onClick={reset} className="text-text-dim hover-text shrink-0" aria-label="Отмена">
              <X size={16} />
            </button>
          </div>

          <label className="block text-xs text-text-muted mb-1.5">
            Для подтверждения введите <code className="num font-mono px-1 rounded" style={{ background: 'var(--color-surface-2)' }}>WIPE</code>
          </label>
          <input
            type="text"
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            className="input w-full mb-3"
            placeholder="WIPE"
            autoComplete="off"
          />

          {error && (
            <div
              className="text-xs px-3 py-2 rounded-lg mb-3"
              style={{
                background: 'color-mix(in oklab, var(--color-danger) 10%, transparent)',
                color: 'var(--color-danger)',
                border: '1px solid color-mix(in oklab, var(--color-danger) 30%, transparent)',
              }}
            >
              {error}
            </div>
          )}

          {result && !error && (
            <div
              className="text-xs px-3 py-2 rounded-lg mb-3 flex items-start gap-2"
              style={{
                background: 'color-mix(in oklab, var(--color-green) 10%, transparent)',
                color: 'var(--color-green)',
                border: '1px solid color-mix(in oklab, var(--color-green) 30%, transparent)',
              }}
            >
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Очистка выполнена</p>
                <ul className="num mt-1 text-text-muted">
                  {Object.entries(result).map(([t, n]) => (
                    <li key={t}>{t}: <span className="font-semibold">{n}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runWipe}
              disabled={busy || phrase.trim() !== 'WIPE'}
              className="text-sm font-medium px-3 py-2 rounded-xl flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--color-danger)',
                color: 'white',
              }}
            >
              <Trash2 size={14} />
              {busy ? 'Удаление…' : 'Удалить всё'}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="text-sm px-3 py-2 rounded-xl text-text-muted hover-text hover-surface"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
