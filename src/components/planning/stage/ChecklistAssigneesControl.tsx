'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import EmployeePickerPanel, { type PickerEmployee } from './EmployeePickerPanel'
import { setChecklistItemAssignees } from '@/lib/actions/checklist'
import { formatNameShort, getFirstName } from '@/lib/utils/name'

// ─────────────────────────────────────────────────────────────────────────────
// Pills с именами ответственных за пункт чек-листа + multi-picker.
//
// Дизайн: каждый ассигни = pill (инициал в кружке + «Имя Ф.»). До 3 в строке,
// дальше «+N» pill. Клик в любое место — открывает picker.
// На карточке оборачиваем в data-no-toggle="true" в родителе.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 3

export type ChecklistAssignee = {
  id: string
  full_name: string
  role?: string | null
  position?: string | null
  assigned_at?: string | null
}

export default function ChecklistAssigneesControl({
  itemId,
  projectId,
  canManage,
  assignees,
  employees,
}: {
  itemId: string
  projectId: string
  canManage: boolean
  assignees: ChecklistAssignee[]
  employees: PickerEmployee[]
}) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState<ChecklistAssignee[]>(assignees)
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setOptimistic(assignees) }, [assignees])

  function applyChange(ids: string[]) {
    // Оптимистично: подбираем профили по id из employees.
    const empById = new Map(employees.map(e => [e.id, e]))
    const next: ChecklistAssignee[] = ids
      .map(id => empById.get(id))
      .filter((e): e is PickerEmployee => Boolean(e))
      .map(e => ({ id: e.id, full_name: e.full_name, role: e.role, position: e.position }))
    setOptimistic(next)

    startTransition(async () => {
      const result = await setChecklistItemAssignees({ itemId, projectId, profileIds: ids })
      if (result.error) {
        setOptimistic(assignees)        // откат
      } else {
        router.refresh()
      }
    })
  }

  const visible = optimistic.slice(0, MAX_VISIBLE)
  const overflow = Math.max(0, optimistic.length - MAX_VISIBLE)

  // Пусто и нельзя управлять — ничего не показываем
  if (optimistic.length === 0 && !canManage) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!canManage) return
          setOpen(true)
        }}
        disabled={!canManage || pending}
        aria-label={
          optimistic.length === 0
            ? 'Назначить ответственных за пункт'
            : `Ответственные за пункт: ${optimistic.map(a => getFirstName(a.full_name)).join(', ')}`
        }
        className={
          optimistic.length === 0
            ? 'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md disabled:opacity-60'
            : 'inline-flex items-center gap-1 flex-wrap rounded-md disabled:opacity-60 text-left'
        }
        style={{
          cursor: canManage ? 'pointer' : 'default',
          ...(optimistic.length === 0
            ? {
                // Solid-кнопка «+ Назначить» — основной CTA менеджера. Зелёный
                // акцент, не dashed: эта кнопка ДОЛЖНА ловиться взглядом.
                background: 'var(--green-glow)',
                color: 'var(--color-green)',
                border: '1px solid color-mix(in oklab, var(--color-green) 32%, transparent)',
              }
            : {}),
        }}
        data-no-toggle="true"
      >
        {optimistic.length === 0 ? (
          <>
            <Plus size={12} strokeWidth={2.5} />
            Назначить
          </>
        ) : (
          <>
            {visible.map(a => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium pl-0.5 pr-2 py-0.5 rounded-full"
                title={`${a.full_name}${a.assigned_at ? ' · назначен ' + formatShortDate(a.assigned_at) : ''}`}
                style={{
                  background: 'color-mix(in oklab, var(--color-green) 10%, transparent)',
                  color: 'var(--color-green)',
                  border: '1px solid color-mix(in oklab, var(--color-green) 30%, transparent)',
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{
                    background: 'color-mix(in oklab, var(--color-green) 28%, transparent)',
                    color: 'var(--color-green)',
                  }}
                  aria-hidden
                >
                  {a.full_name.charAt(0).toUpperCase()}
                </span>
                <span className="whitespace-nowrap">{formatNameShort(a.full_name)}</span>
              </span>
            ))}
            {overflow > 0 && (
              <span
                className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
                title={optimistic.slice(MAX_VISIBLE).map(a => a.full_name).join(', ')}
                style={{
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border-2)',
                }}
              >
                +{overflow}
              </span>
            )}
          </>
        )}
      </button>

      {open && (
        <EmployeePickerPanel
          mode="multi"
          anchorRef={triggerRef}
          employees={employees}
          selectedIds={optimistic.map(a => a.id)}
          onConfirm={applyChange}
          onClose={() => setOpen(false)}
          ariaLabel="Ответственные за пункт чек-листа"
        />
      )}
    </>
  )
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      timeZone: 'Asia/Oral',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch { return '' }
}
