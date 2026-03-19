'use client'

import { useState, useTransition } from 'react'
import { Trash2, X, AlertTriangle } from 'lucide-react'
import { deleteProject } from '@/lib/actions/projects'

export default function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      await deleteProject(projectId)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl transition-colors"
        style={{ color: 'var(--text-dim)', border: '1px solid var(--border)' }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.color = '#f87171'
          el.style.borderColor = 'rgba(239,68,68,0.3)'
          el.style.background = 'rgba(239,68,68,0.06)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.color = 'var(--text-dim)'
          el.style.borderColor = 'var(--border)'
          el.style.background = 'transparent'
        }}
      >
        <Trash2 size={14} />
        Удалить проект
      </button>

      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} style={{ color: '#f87171' }} />
                <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Удалить проект</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{projectName}</p>
              </div>
              <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>
                Вы уверены, что хотите удалить этот проект?
              </p>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                Будут удалены все этапы, задачи, чек-листы и прикреплённые файлы. Действие необратимо.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 text-sm font-medium py-2.5 rounded-xl"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}
                >
                  Отмена
                </button>
                <button
                  onClick={confirm}
                  disabled={pending}
                  className="flex-1 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.22)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'}
                >
                  {pending ? 'Удаление...' : 'Удалить проект'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
