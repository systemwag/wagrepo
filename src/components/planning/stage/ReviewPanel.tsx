'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, RotateCcw, ShieldCheck } from 'lucide-react'
import type { DesignStage, ReviewStatus } from '@/lib/constants/design-stages'
import { REVIEW_STATUS_LABEL } from '@/lib/constants/design-stages'
import { updateStageReview } from '@/lib/actions/stages'
import SectionBlock from './SectionBlock'

const REVIEW_CONFIG: {
  value: ReviewStatus
  label: string
  icon: React.ReactNode
  bg: string
  color: string
  border: string
}[] = [
  { value: 'pending_review',  label: 'На проверке',  icon: <Clock size={13} />,       bg: 'rgba(234,179,8,0.1)',  color: '#ca8a04',    border: 'rgba(234,179,8,0.25)' },
  { value: 'approved',        label: 'Одобрено',     icon: <ShieldCheck size={13} />, bg: 'var(--green-glow)',    color: 'var(--green)', border: 'rgba(34,197,94,0.25)' },
  { value: 'revision_needed', label: 'На доработку', icon: <RotateCcw size={13} />,   bg: 'rgba(249,115,22,0.1)', color: '#fb923c',    border: 'rgba(249,115,22,0.25)' },
]

export default function ReviewPanel({
  stage,
  projectId,
  userRole,
}: {
  stage: DesignStage
  projectId: string
  userRole: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [optimisticReview, setOptimisticReview] = useState<ReviewStatus | null>(stage.review_status)
  const isDirector = userRole === 'director'

  // Sync state с prop — допустимый паттерн для optimistic-обёрток.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOptimisticReview(stage.review_status) }, [stage.review_status])

  function handleChange(val: ReviewStatus) {
    const next = val === optimisticReview ? null : val
    setOptimisticReview(next)
    startTransition(async () => {
      const result = await updateStageReview(stage.id, next, projectId)
      if (result.error) setOptimisticReview(stage.review_status)
      else router.refresh()
    })
  }

  const activeCfg = REVIEW_CONFIG.find(c => c.value === optimisticReview)

  return (
    <SectionBlock icon={<ShieldCheck size={13} />} title="Проверка руководителя">
      <div
        className="rounded-xl p-3"
        style={{
          background: 'var(--surface-2)',
          border: activeCfg ? `1px solid ${activeCfg.border}` : '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between mb-2.5">
          {activeCfg ? (
            <span
              className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full font-medium"
              style={{ background: activeCfg.bg, color: activeCfg.color, border: `1px solid ${activeCfg.border}` }}
            >
              {activeCfg.icon}
              {REVIEW_STATUS_LABEL[optimisticReview!]}
            </span>
          ) : (
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>Не проверено</span>
          )}
        </div>

        {isDirector ? (
          <div className="flex gap-2 flex-wrap">
            {REVIEW_CONFIG.map(cfg => {
              const isActive = cfg.value === optimisticReview
              return (
                <button
                  key={cfg.value}
                  type="button"
                  onClick={() => handleChange(cfg.value)}
                  disabled={pending}
                  aria-pressed={isActive}
                  className="chip-themed flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-medium"
                  data-active={isActive ? 'true' : 'false'}
                  style={{
                    ['--chip-bg' as string]: cfg.bg,
                    ['--chip-color' as string]: cfg.color,
                    ['--chip-border' as string]: cfg.border,
                  }}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              )
            })}
          </div>
        ) : (
          !optimisticReview && (
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Ожидается проверка руководителя</p>
          )
        )}
      </div>
    </SectionBlock>
  )
}
