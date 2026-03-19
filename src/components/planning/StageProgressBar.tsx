import type { DesignStage } from '@/lib/constants/design-stages'

export default function StageProgressBar({ stages }: { stages: DesignStage[] }) {
  if (!stages.length) return null

  const completed = stages.filter(s => s.status === 'completed').length
  const inProgress = stages.filter(s => s.status === 'in_progress').length
  const total = stages.length
  const pct = Math.round((completed / total) * 100)

  const totalItems = stages.reduce((sum, s) => sum + s.checklist_items.length, 0)
  const doneItems  = stages.reduce((sum, s) => sum + s.checklist_items.filter(i => i.is_completed).length, 0)

  return (
    <div className="flex items-center gap-4">
      {/* Прогресс-бар */}
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'var(--green)' }}
        />
      </div>

      {/* Счётчики */}
      <div className="flex items-center gap-3 flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>{completed}</span>
          <span>/{total} этапов</span>
        </span>
        {inProgress > 0 && (
          <span style={{ color: '#60a5fa' }}>{inProgress} в работе</span>
        )}
        {totalItems > 0 && (
          <span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{doneItems}</span>
            <span>/{totalItems} пунктов</span>
          </span>
        )}
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{pct}%</span>
      </div>
    </div>
  )
}
