import type { StageStatus } from '@/lib/constants/design-stages'
import { STAGE_STATUS_LABEL } from '@/lib/constants/design-stages'

const styles: Record<StageStatus, React.CSSProperties> = {
  pending:     { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' },
  in_progress: { background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' },
  completed:   { background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' },
  blocked:     { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' },
}

export default function StageStatusBadge({ status }: { status: StageStatus }) {
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
      style={styles[status]}
    >
      {STAGE_STATUS_LABEL[status]}
    </span>
  )
}
