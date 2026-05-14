'use client'

import { useEffect, useState } from 'react'
import { Check as CheckIcon, MoveRight, X } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { moveProjectTask } from '@/lib/actions/project-tasks'
import { STAGE_COLORS, STAGE_ICONS, type Stage } from './_shared'

interface Props {
  taskId: string
  taskTitle: string
  currentStageId: string | null
  stages: Stage[]
  projectId: string
  onClose: () => void
  onMoved: () => void
}

export default function MoveTaskSheet({
  taskId,
  taskTitle,
  currentStageId,
  stages,
  projectId,
  onClose,
  onMoved,
}: Props) {
  const [moving, setMoving] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function pick(stageId: string) {
    if (stageId === currentStageId || moving) return
    setMoving(stageId)
    await moveProjectTask(taskId, stageId, projectId)
    setMoving(null)
    onMoved()
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100]"
        style={{ background: 'color-mix(in oklab, black 60%, transparent)' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed z-[101] flex flex-col
                   left-0 right-0 bottom-0 max-h-[85vh] rounded-t-2xl
                   sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                   sm:w-[460px] sm:max-h-[80vh] sm:rounded-2xl
                   animate-fade-up"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'color-mix(in oklab, var(--color-green) 15%, transparent)',
              color: 'var(--color-green)',
            }}
          >
            <MoveRight size={16} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-text-dim">Переместить задачу</p>
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
              {taskTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-2 -m-2 rounded-lg hover-surface text-text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stage list */}
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {stages.map((stage, idx) => {
            const sc = STAGE_COLORS[idx % STAGE_COLORS.length]
            const Icon = STAGE_ICONS[idx % STAGE_ICONS.length]
            const current = stage.id === currentStageId
            const busy = moving === stage.id
            return (
              <li key={stage.id}>
                <button
                  type="button"
                  onClick={() => pick(stage.id)}
                  disabled={current || busy}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors disabled:opacity-60"
                  style={{
                    background: current
                      ? `color-mix(in oklab, ${sc.color} 10%, transparent)`
                      : 'transparent',
                    border: `1px solid ${current ? `color-mix(in oklab, ${sc.color} 30%, transparent)` : 'transparent'}`,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${sc.color}22`,
                      color: sc.color,
                      border: `1px solid ${sc.color}44`,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {stage.name}
                    </p>
                    {current && (
                      <p className="text-xs text-text-muted">Текущий этап</p>
                    )}
                  </div>
                  {current && <CheckIcon size={16} style={{ color: sc.color }} />}
                  {busy && (
                    <span className="text-xs text-text-muted">…</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Portal>
  )
}
