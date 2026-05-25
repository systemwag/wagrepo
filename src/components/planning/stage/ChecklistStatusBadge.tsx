'use client'

import { AlertTriangle, Check, Clock, User } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Статус-чип пункта чек-листа. Показывает текущее состояние:
//   pending      → не рендерим (тишина — карточка сама по себе про «нет ничего»)
//   assigned     → фиолетовый «Назначен»
//   in_progress  → синий «В работе»
//   overdue      → красный «Просрочен» (приоритетнее in_progress)
//   completed    → зелёный «Готово»
// ─────────────────────────────────────────────────────────────────────────────

export type ChecklistVisualState =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'overdue'
  | 'completed'

type Tone = {
  fg: string
  bg: string
  border: string
  label: string
  icon: React.ReactNode
}

const TONES: Record<Exclude<ChecklistVisualState, 'pending'>, Tone> = {
  assigned: {
    fg:     '#a78bfa',
    bg:     'color-mix(in oklab, #a78bfa 14%, transparent)',
    border: 'color-mix(in oklab, #a78bfa 32%, transparent)',
    label:  'Назначен',
    icon:   <User size={11} />,
  },
  in_progress: {
    fg:     '#60a5fa',
    bg:     'color-mix(in oklab, #60a5fa 14%, transparent)',
    border: 'color-mix(in oklab, #60a5fa 32%, transparent)',
    label:  'В работе',
    icon:   <Clock size={11} />,
  },
  overdue: {
    fg:     'var(--color-danger)',
    bg:     'color-mix(in oklab, var(--color-danger) 14%, transparent)',
    border: 'color-mix(in oklab, var(--color-danger) 32%, transparent)',
    label:  'Просрочен',
    icon:   <AlertTriangle size={11} />,
  },
  completed: {
    fg:     'var(--color-green)',
    bg:     'var(--green-glow)',
    border: 'color-mix(in oklab, var(--color-green) 32%, transparent)',
    label:  'Готово',
    icon:   <Check size={11} strokeWidth={3} />,
  },
}

export default function ChecklistStatusBadge({ state }: { state: ChecklistVisualState }) {
  if (state === 'pending') return null
  const tone = TONES[state]
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{
        color: tone.fg,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
      }}
    >
      {tone.icon}
      {tone.label}
    </span>
  )
}
