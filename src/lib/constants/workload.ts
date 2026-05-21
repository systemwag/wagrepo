import type { LucideIcon } from 'lucide-react'
import {
  BatteryLow, Smile, Zap, Flame, Siren,
  ThumbsUp, Heart, Eye, HelpCircle,
} from 'lucide-react'

// Шкала самооценки загруженности — общая для формы дейли и виджетов команды.
// Значения 1..5 хранятся в daily_reports.workload (smallint CHECK BETWEEN 1 AND 5,
// миграция 015). Иконки — Lucide одной толщины 1.6 для визуальной согласованности
// (вместо native-эмодзи, которые рендерятся по-разному на Windows/iOS/Android).

export type WorkloadValue = 1 | 2 | 3 | 4 | 5

export type WorkloadItem = {
  value: WorkloadValue
  label: string
  icon: LucideIcon
  color: string
  bg: string
  border: string
}

export const WORKLOAD: WorkloadItem[] = [
  { value: 1, label: 'Мало',   icon: BatteryLow, color: '#60a5fa',      bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)' },
  { value: 2, label: 'Норма',  icon: Smile,      color: 'var(--green)', bg: 'var(--green-glow)',     border: 'rgba(34,197,94,0.3)'  },
  { value: 3, label: 'Занят',  icon: Zap,        color: '#f59e0b',      bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  { value: 4, label: 'Тяжело', icon: Flame,      color: '#fb923c',      bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)' },
  { value: 5, label: 'Аврал',  icon: Siren,      color: '#f87171',      bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'  },
]

export function findWorkload(value: number | null | undefined): WorkloadItem | undefined {
  if (value == null) return undefined
  return WORKLOAD.find(w => w.value === value)
}

// Реакции руководителя на чужой дейли-отчёт. Один общий стиль с workload —
// Lucide-иконки в кружках, никаких native-эмодзи. Хранятся в БД как короткие
// строковые ключи (поле `emoji` в daily_report_reactions), чтобы front
// был независим от конкретной иконки.

// Короткие kind-ключи (≤8 символов) — хранятся в daily_report_reactions.emoji
// (поле TEXT, миграция 062 имеет CHECK char_length BETWEEN 1 AND 8).
export type ReactionKind = 'ok' | 'love' | 'fire' | 'eye' | 'ask'

export type ReactionItem = {
  kind:  ReactionKind
  icon:  LucideIcon
  hint:  string
  color: string
}

export const DAILY_REACTIONS: ReactionItem[] = [
  { kind: 'ok',   icon: ThumbsUp,   hint: 'Молодец',  color: 'var(--green)' },
  { kind: 'love', icon: Heart,      hint: 'Спасибо',  color: '#f87171'      },
  { kind: 'fire', icon: Flame,      hint: 'Огонь',    color: '#fb923c'      },
  { kind: 'eye',  icon: Eye,        hint: 'Прочитал', color: '#60a5fa'      },
  { kind: 'ask',  icon: HelpCircle, hint: 'Уточни',   color: '#a78bfa'      },
]

export function findReaction(kind: string): ReactionItem | undefined {
  return DAILY_REACTIONS.find(r => r.kind === kind)
}
