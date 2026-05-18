'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GanttError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[gantt] page error', error)
  }, [error])

  return (
    <div className="card py-16 text-center">
      <AlertTriangle size={36} className="mx-auto mb-3" style={{ color: 'var(--color-danger)' }} />
      <p className="font-semibold" style={{ color: 'var(--text)' }}>Не удалось загрузить график</p>
      <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-dim)' }}>
        Проблема с подключением к базе. Попробуйте перезагрузить страницу.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium hover-surface"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        <RefreshCw size={14} />
        Попробовать снова
      </button>
    </div>
  )
}
