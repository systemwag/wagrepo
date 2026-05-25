'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, CalendarClock, X } from 'lucide-react'
import { setChecklistItemDeadline } from '@/lib/actions/checklist'
import DatePickerPopover from '@/components/ui/DatePickerPopover'

// ─────────────────────────────────────────────────────────────────────────────
// Чип «дедлайн пункта». При canManage клик открывает кастомный календарь
// в стиле проекта (DatePickerPopover). Натив-инпут не используем —
// чужеродный UX на десктопе.
//
// Цвета: warn ≤ 2 дней до, danger при просрочке. Если пункт выполнен —
// нейтральный, без цвета просрочки.
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  itemId: string
  projectId: string
  canManage: boolean
  deadline: string | null      // YYYY-MM-DD
  isCompleted: boolean
}

export default function ChecklistDeadlineChip({
  itemId, projectId, canManage, deadline, isCompleted,
}: Props) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState<string | null>(deadline)
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  // Подхватываем серверное обновление (router.refresh / RSC re-render).
  useEffect(() => { setOptimistic(deadline) }, [deadline])

  function commit(value: string | null) {
    setOptimistic(value)
    startTransition(async () => {
      const result = await setChecklistItemDeadline({ itemId, projectId, deadline: value })
      if (result.error) {
        setOptimistic(deadline)
      } else {
        router.refresh()
      }
    })
  }

  function handleTrigger(e: React.MouseEvent) {
    e.stopPropagation()
    if (!canManage) return
    setOpen(o => !o)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    commit(null)
  }

  if (!optimistic && !canManage) return null

  // ── Кейс: дедлайна нет, но canManage — кнопка «добавить дедлайн»
  if (!optimistic) {
    return (
      <>
        <button
          ref={anchorRef}
          type="button"
          onClick={handleTrigger}
          aria-label="Добавить дедлайн"
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
          data-no-toggle="true"
        >
          <CalendarPlus size={12} />
          Срок
        </button>
        {open && (
          <DatePickerPopover
            value={null}
            onChange={commit}
            onClose={() => setOpen(false)}
            anchorRef={anchorRef}
            ariaLabel="Установить дедлайн пункта"
          />
        )}
      </>
    )
  }

  // ── Кейс: дедлайн установлен
  const tone = computeTone(optimistic, isCompleted)
  const label = formatDeadline(optimistic)

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={handleTrigger}
        aria-label={`Дедлайн: ${label}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md"
        style={{
          background: tone.bg,
          border: `1px solid ${tone.border}`,
          color: tone.fg,
          opacity: isCompleted ? 0.7 : 1,
          cursor: canManage ? 'pointer' : 'default',
        }}
        data-no-toggle="true"
      >
        <CalendarClock size={12} />
        <span className="num">{label}</span>
        {canManage && (
          <span
            onClick={handleClear}
            role="button"
            aria-label="Снять дедлайн"
            className="ml-0.5 p-0.5 rounded hover:opacity-100 opacity-60"
            style={{ color: tone.fg }}
          >
            <X size={10} />
          </span>
        )}
      </button>
      {open && (
        <DatePickerPopover
          value={optimistic}
          onChange={commit}
          onClose={() => setOpen(false)}
          anchorRef={anchorRef}
          ariaLabel="Изменить дедлайн пункта"
        />
      )}
    </>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────────

function todayOral(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Oral' })  // YYYY-MM-DD
}

function daysDiff(deadline: string, today: string): number {
  // Парсим как UTC midnight — оба представляют календарную дату в Asia/Oral,
  // а разница в днях не зависит от TZ.
  const d1 = new Date(deadline + 'T00:00:00Z').getTime()
  const d0 = new Date(today    + 'T00:00:00Z').getTime()
  return Math.round((d1 - d0) / 86_400_000)
}

function computeTone(deadline: string, isCompleted: boolean) {
  const NEUTRAL = {
    fg:     'var(--color-text-muted)',
    bg:     'var(--color-surface-2)',
    border: 'var(--color-border-2)',
  }
  if (isCompleted) return NEUTRAL

  const diff = daysDiff(deadline, todayOral())
  if (diff < 0) {
    return {
      fg:     'var(--color-danger)',
      bg:     'color-mix(in oklab, var(--color-danger) 12%, transparent)',
      border: 'color-mix(in oklab, var(--color-danger) 30%, transparent)',
    }
  }
  if (diff <= 2) {
    return {
      fg:     'var(--color-warn)',
      bg:     'color-mix(in oklab, var(--color-warn) 12%, transparent)',
      border: 'color-mix(in oklab, var(--color-warn) 30%, transparent)',
    }
  }
  return NEUTRAL
}

function formatDeadline(deadline: string): string {
  try {
    // Парсим как midnight UTC — отображение даёт ru-RU без сдвига дня.
    return new Date(deadline + 'T00:00:00Z').toLocaleDateString('ru-RU', {
      timeZone: 'UTC', day: 'numeric', month: 'short',
    })
  } catch {
    return deadline
  }
}
