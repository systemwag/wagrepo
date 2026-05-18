'use client'

import { Check, Loader2, Lock, AlertTriangle, Clock } from 'lucide-react'
import type { DesignStage, StageStatus } from '@/lib/constants/design-stages'
import { stageTheme } from '@/components/projects/board/_shared'

type Props = {
  stages: DesignStage[]
  expandedId: string | null
  onSelect: (id: string) => void
}

// Иконки тоже привязаны к статусу. Цвет/фон — из единого stageTheme().
const STATUS_ICON: Record<StageStatus, React.ReactNode> = {
  pending:     <Clock   size={11} />,
  in_progress: <Loader2 size={11} />,
  completed:   <Check   size={11} />,
  blocked:     <Lock    size={11} />,
}

export default function StageTimelineNav({ stages, expandedId, onSelect }: Props) {
  return (
    <nav
      aria-label="Этапы проекта"
      className="sticky top-4 self-start rounded-2xl p-2"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-xs uppercase tracking-wider px-2 pt-1 pb-2" style={{ color: 'var(--color-text-dim)' }}>
        Этапы
      </p>
      <ol className="relative">
        {/* Вертикальная нить между маркерами */}
        <span
          aria-hidden
          className="absolute left-[18px] top-2 bottom-2 w-px"
          style={{ background: 'var(--color-border)' }}
        />
        {stages.map((stage, idx) => {
          const active = expandedId === stage.id
          const theme = stageTheme(stage.status)
          const icon = STATUS_ICON[stage.status] ?? STATUS_ICON.pending
          const overdue = stage.deadline && new Date(stage.deadline) < new Date() && stage.status !== 'completed'
          const checklistTotal = stage.checklist_items.length
          const checklistDone  = stage.checklist_items.filter(i => i.is_completed).length
          const num = String(idx + 1).padStart(2, '0')

          return (
            <li key={stage.id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(stage.id)}
                className="w-full flex items-start gap-2.5 px-2 py-2 rounded-xl text-left transition-colors"
                style={{
                  background: active
                    ? 'color-mix(in oklab, var(--color-green) 12%, transparent)'
                    : 'transparent',
                  border: `1px solid ${active
                    ? 'color-mix(in oklab, var(--color-green) 25%, transparent)'
                    : 'transparent'}`,
                }}
                aria-current={active ? 'true' : undefined}
              >
                {/* Маркер */}
                <span
                  className="relative z-10 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: theme.bg,
                    color: theme.color,
                    border: `1.5px solid ${active ? 'var(--color-green)' : theme.color}`,
                  }}
                >
                  {icon}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="num text-[10px] font-bold tracking-wider"
                      style={{ color: 'var(--color-text-dim)' }}
                    >
                      {num}
                    </span>
                    <span
                      className="text-sm leading-tight truncate"
                      style={{
                        color: active ? 'var(--color-green)' : 'var(--color-text)',
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      {stage.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                    {checklistTotal > 0 && (
                      <span className="num">{checklistDone}/{checklistTotal}</span>
                    )}
                    {overdue && (
                      <span className="flex items-center gap-0.5" style={{ color: 'var(--color-danger)' }}>
                        <AlertTriangle size={9} />
                        просрочен
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
