'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, AlertTriangle, X } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { cleanupOldActivity } from './actions'

export default function CleanupButton({ daysOld = 30 }: { daysOld?: number }) {
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [done, setDone] = useState<{ deleted: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleConfirm() {
    setWorking(true); setError(null)
    const res = await cleanupOldActivity(daysOld)
    setWorking(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setDone({ deleted: res.deleted })
    router.refresh()
  }

  function close() {
    setOpen(false)
    // Сброс состояния после закрытия с задержкой — чтобы не мигало
    setTimeout(() => { setDone(null); setError(null) }, 200)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
        style={{
          color: 'var(--text-muted)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-danger)'; (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in oklab, var(--color-danger) 30%, transparent)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
      >
        <Trash2 size={14} />
        Очистить старее месяца
      </button>

      {open && (
        <Portal>
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) close() }}
          >
            <div className="card w-full max-w-md" onMouseDown={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} style={{ color: 'var(--color-warn)' }} />
                  <h2 className="font-semibold text-base text-text">Очистить старые записи</h2>
                </div>
                <button onClick={close} className="w-8 h-8 rounded-xl flex items-center justify-center text-text-muted">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6">
                {done ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-text">Удалено записей: <span className="font-semibold num">{done.deleted}</span></p>
                    <button
                      onClick={close}
                      className="mt-4 btn-green px-5"
                    >
                      Готово
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-text mb-2">
                      Будут удалены все записи активити-лога старше {daysOld} дней.
                    </p>
                    <p className="text-xs text-text-muted mb-5">
                      Действие необратимо. Записи стираются окончательно.
                    </p>

                    {error && (
                      <p className="text-xs px-3 py-2 mb-3 rounded-lg"
                        style={{ background: 'color-mix(in oklab, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)' }}>
                        {error}
                      </p>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={close}
                        className="flex-1 text-sm font-medium py-2.5 rounded-xl"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}
                      >
                        Отмена
                      </button>
                      <button
                        onClick={handleConfirm}
                        disabled={working}
                        className="flex-1 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{ background: 'color-mix(in oklab, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in oklab, var(--color-danger) 30%, transparent)' }}
                      >
                        {working ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        {working ? 'Очистка...' : 'Очистить'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
