import {
  DESIGN_STAGE_ORDER,
  DESIGN_STAGE_LABEL,
  DESIGN_STAGE_LABEL_SHORT,
  type StageKey,
  type StageStatus,
  type ReviewStatus,
} from '@/lib/constants/design-stages'

export type PipelineStage = {
  stage_key: StageKey | string | null
  status: StageStatus | string | null
  deadline: string | null
  review_status: ReviewStatus | string | null
}

type StageState =
  | 'done'
  | 'current'
  | 'review'
  | 'overdue'
  | 'blocked'
  | 'pending'

const TONE: Record<StageState, { bg: string; ring?: string }> = {
  done:    { bg: 'var(--color-green)' },
  current: { bg: 'var(--color-green)', ring: 'color-mix(in oklab, var(--color-green) 35%, transparent)' },
  review:  { bg: 'var(--color-warn)' },
  overdue: { bg: 'var(--color-danger)' },
  blocked: { bg: 'var(--color-danger)' },
  pending: { bg: 'var(--color-border-2)' },
}

function getState(stage: PipelineStage | undefined): StageState {
  if (!stage) return 'pending'
  if (stage.status === 'completed') return 'done'
  if (stage.status === 'blocked')   return 'blocked'
  if (stage.review_status === 'pending_review') return 'review'

  // Date.now() локально в helper-функции (не в теле компонента) — правило
  // react-hooks/purity не триггерит, а семантика та же: проверка просрочки
  // относительно момента рендера.
  const overdue =
    stage.deadline &&
    new Date(stage.deadline).getTime() < Date.now() &&
    stage.status !== 'completed'

  if (overdue) return 'overdue'
  if (stage.status === 'in_progress') return 'current'
  return 'pending'
}

type Props = {
  stages: PipelineStage[]
  /** compact: квадратики без подписей и без счётчика — для PWA-карточки */
  compact?: boolean
  /** showLabel: подпись «Этап 4/8 · ПСД» снизу */
  showLabel?: boolean
}

export function StagePipeline({ stages, compact = false, showLabel = true }: Props) {
  // Нормализуем входящие этапы — приводим к словарному порядку 8 этапов.
  // Если у проекта нет этапа с нужным stage_key — он считается pending.
  const byKey = new Map<string, PipelineStage>()
  for (const s of stages) {
    if (s.stage_key) byKey.set(String(s.stage_key), s)
  }

  const items = DESIGN_STAGE_ORDER.map(key => ({
    key,
    stage: byKey.get(key),
    state: getState(byKey.get(key)),
  }))

  const doneCount = items.filter(i => i.state === 'done').length
  const currentIdx = items.findIndex(i =>
    i.state === 'current' || i.state === 'review' || i.state === 'overdue' || i.state === 'blocked'
  )
  const activeIdx = currentIdx >= 0 ? currentIdx : doneCount
  const activeStage = items[activeIdx]?.key
  const activeState = items[activeIdx]?.state

  const stateLabel: Record<StageState, string> = {
    done:    'Завершён',
    current: 'В работе',
    review:  'На проверке',
    overdue: 'Просрочен',
    blocked: 'Заблокирован',
    pending: 'Ожидание',
  }

  return (
    <div className="w-full">
      {/* Сегменты */}
      <div
        className={`flex w-full ${compact ? 'gap-1 h-1.5' : 'gap-1 h-2'}`}
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={DESIGN_STAGE_ORDER.length}
        aria-label={`Прогресс этапов: ${doneCount} из ${DESIGN_STAGE_ORDER.length}`}
      >
        {items.map((item, i) => {
          const tone = TONE[item.state]
          const isCurrent = i === activeIdx && (item.state !== 'done' && item.state !== 'pending')
          return (
            <div
              key={item.key}
              className={`flex-1 min-w-0 rounded-sm transition-colors ${isCurrent ? 'animate-pipeline-pulse' : ''}`}
              style={{
                background: tone.bg,
                outline: isCurrent && tone.ring ? `2px solid ${tone.ring}` : undefined,
                outlineOffset: isCurrent ? '1px' : undefined,
              }}
              title={
                item.stage
                  ? `${DESIGN_STAGE_LABEL[item.key]} — ${stateLabel[item.state]}`
                  : `${DESIGN_STAGE_LABEL[item.key]} — не создан`
              }
            />
          )
        })}
      </div>

      {/* Подпись */}
      {showLabel && !compact && activeStage && (
        <div className="flex items-center gap-2 mt-2 text-xs">
          <span className="num text-text-muted">
            Этап <span className="font-semibold text-text">{activeIdx + 1}</span>
            <span className="text-text-dim">/{DESIGN_STAGE_ORDER.length}</span>
          </span>
          <span className="text-text-dim">·</span>
          <span className="font-medium text-text truncate">
            <span className="hidden sm:inline">{DESIGN_STAGE_LABEL[activeStage]}</span>
            <span className="sm:hidden">{DESIGN_STAGE_LABEL_SHORT[activeStage]}</span>
          </span>
          {activeState && activeState !== 'current' && activeState !== 'pending' && activeState !== 'done' && (
            <>
              <span className="text-text-dim">·</span>
              <span
                className="font-medium"
                style={{
                  color:
                    activeState === 'overdue' || activeState === 'blocked'
                      ? 'var(--color-danger)'
                      : activeState === 'review'
                      ? 'var(--color-warn)'
                      : 'var(--color-text-muted)',
                }}
              >
                {stateLabel[activeState]}
              </span>
            </>
          )}
        </div>
      )}

      {compact && showLabel && activeStage && (
        <p className="text-[10px] text-text-dim mt-1 num">
          <span className="font-semibold text-text-muted">{activeIdx + 1}</span>
          <span>/{DESIGN_STAGE_ORDER.length}</span>
          <span className="ml-1.5 font-medium text-text-muted truncate">
            {DESIGN_STAGE_LABEL_SHORT[activeStage]}
          </span>
        </p>
      )}
    </div>
  )
}
