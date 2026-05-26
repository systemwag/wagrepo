'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import {
  Layers, ClipboardList, ListChecks, FolderOpen, Workflow,
  CalendarDays, MessageCircleQuestion, FileText,
} from 'lucide-react'
import type { ActivityItem } from '@/components/ui/ActivityFeed'

type EntityKey = ActivityItem['entity_type']

const CHIPS: { value: EntityKey | null; label: string; icon: React.ReactNode }[] = [
  { value: null,            label: 'Все',          icon: <Layers size={14} /> },
  { value: 'direct_task',   label: 'Поручения',    icon: <ClipboardList size={14} /> },
  { value: 'project_task',  label: 'Задачи',       icon: <ListChecks size={14} /> },
  { value: 'project',       label: 'Проекты',      icon: <FolderOpen size={14} /> },
  { value: 'stage',         label: 'Этапы',        icon: <Workflow size={14} /> },
  { value: 'event',         label: 'События',      icon: <CalendarDays size={14} /> },
  { value: 'poll',          label: 'Опросы',       icon: <MessageCircleQuestion size={14} /> },
  { value: 'daily_report',  label: 'Дейли',        icon: <FileText size={14} /> },
]

export default function ActivityFilters({ active }: { active: EntityKey | null }) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function select(value: EntityKey | null) {
    const next = new URLSearchParams(params)
    if (value) next.set('entity', value); else next.delete('entity')
    const qs = next.toString()
    startTransition(() => {
      router.replace(qs ? `/dashboard/activity?${qs}` : '/dashboard/activity', { scroll: false })
    })
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6" data-pending={pending || undefined}>
      {CHIPS.map(chip => {
        const isActive = chip.value === active
        return (
          <button
            key={chip.value ?? 'all'}
            type="button"
            onClick={() => select(chip.value)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
            style={{
              color: isActive ? 'var(--green)' : 'var(--text-muted)',
              background: isActive ? 'var(--green-glow)' : 'var(--surface)',
              border: `1px solid ${isActive ? 'color-mix(in oklab, var(--green) 35%, transparent)' : 'var(--border)'}`,
            }}
          >
            {chip.icon}
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
