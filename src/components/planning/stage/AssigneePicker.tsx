'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { User, Search, X, Check, Plus } from 'lucide-react'
import type { DesignStage } from '@/lib/constants/design-stages'
import { assignStageResponsible } from '@/lib/actions/stages'
import { Portal } from '@/components/ui/Portal'
import { getFirstName } from '@/lib/utils/name'

type Employee = {
  id: string
  full_name: string
  role?: 'admin' | 'director' | 'manager' | 'employee' | string | null
  position?: string | null
}

const ROLE_LABEL: Record<string, string> = {
  admin:    'Admin',
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}

const ROLE_ORDER: Record<string, number> = {
  director: 0, admin: 1, manager: 2, employee: 3,
}

export default function AssigneePicker({
  stage,
  employees,
  projectId,
  canManage,
}: {
  stage: DesignStage
  employees: Employee[]
  projectId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [saving, startTransition] = useTransition()
  const [optimisticAssignee, setOptimisticAssignee] = useState<Employee | null>(stage.assignee ?? null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOptimisticAssignee(stage.assignee ?? null) }, [stage.assignee])

  function assign(emp: Employee | null) {
    setOptimisticAssignee(emp)
    setOpen(false)
    setQuery('')
    startTransition(async () => {
      const result = await assignStageResponsible(stage.id, emp?.id ?? null, projectId)
      if (result.error) setOptimisticAssignee(stage.assignee ?? null)
      else router.refresh()
    })
  }

  function handleToggle() {
    if (!canManage) return
    setOpen(o => !o)
  }

  // Закрываем по Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const filtered = filterAndGroup(employees, query)

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <User size={12} style={{ color: 'var(--text-dim)' }} />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          Ответственный
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          disabled={!canManage || saving}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="assignee-trigger flex items-center gap-2 px-2.5 py-1.5 rounded-xl disabled:opacity-60"
          style={{
            background: optimisticAssignee
              ? 'color-mix(in oklab, var(--color-green) 10%, transparent)'
              : 'var(--color-surface-2)',
            border: `1px solid ${optimisticAssignee
              ? 'color-mix(in oklab, var(--color-green) 30%, transparent)'
              : 'var(--color-border-2)'}`,
            cursor: canManage ? 'pointer' : 'default',
          }}
        >
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
              background: optimisticAssignee
                ? 'color-mix(in oklab, var(--color-green) 22%, transparent)'
                : 'var(--color-surface)',
              color: optimisticAssignee ? 'var(--color-green)' : 'var(--color-text-dim)',
              border: optimisticAssignee
                ? '1px solid color-mix(in oklab, var(--color-green) 35%, transparent)'
                : '1px dashed var(--color-border-2)',
            }}
          >
            {optimisticAssignee
              ? optimisticAssignee.full_name.charAt(0).toUpperCase()
              : <Plus size={14} />}
          </span>
          <span className="text-sm font-medium" style={{ color: optimisticAssignee ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
            {optimisticAssignee ? getFirstName(optimisticAssignee.full_name) : 'Назначить ответственного'}
          </span>
          {optimisticAssignee && (
            <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              · {ROLE_LABEL[optimisticAssignee.role ?? 'employee'] ?? optimisticAssignee.role}
            </span>
          )}
        </button>

        {optimisticAssignee && canManage && (
          <button
            type="button"
            onClick={() => assign(null)}
            disabled={saving}
            aria-label="Снять ответственного"
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg unassign-btn disabled:opacity-40"
          >
            <X size={11} />
            Снять
          </button>
        )}
      </div>

      {open && (
        <Portal lockScroll={false}>
          <PickerOverlay onClose={() => { setOpen(false); setQuery('') }}>
            <PickerPanel
              anchorRef={buttonRef}
              query={query}
              onQueryChange={setQuery}
              groups={filtered}
              selectedId={optimisticAssignee?.id ?? null}
              onSelect={assign}
              onClose={() => { setOpen(false); setQuery('') }}
            />
          </PickerOverlay>
        </Portal>
      )}
    </div>
  )
}

function filterAndGroup(employees: Employee[], query: string) {
  const q = query.trim().toLowerCase()
  const filtered = q
    ? employees.filter(e =>
        e.full_name.toLowerCase().includes(q) ||
        (e.position ?? '').toLowerCase().includes(q),
      )
    : employees

  const byRole = new Map<string, Employee[]>()
  for (const e of filtered) {
    const role = (e.role ?? 'employee') as string
    const arr = byRole.get(role) ?? []
    arr.push(e)
    byRole.set(role, arr)
  }
  for (const arr of byRole.values()) {
    arr.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))
  }

  return Object.keys(ROLE_ORDER)
    .sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b])
    .filter(role => byRole.has(role))
    .map(role => ({ role, items: byRole.get(role)! }))
}

// ─── Overlay + Panel ─────────────────────────────────────────────────────────

function PickerOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      {/* Затемнение на мобильном — на десктопе прозрачный «catcher» для клика мимо */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[55] md:bg-transparent bg-black/45 md:backdrop-blur-0 backdrop-blur-[2px]"
        aria-hidden
      />
      {children}
    </>
  )
}

function PickerPanel({
  anchorRef,
  query,
  onQueryChange,
  groups,
  selectedId,
  onSelect,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  query: string
  onQueryChange: (v: string) => void
  groups: { role: string; items: Employee[] }[]
  selectedId: string | null
  onSelect: (emp: Employee | null) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Позиционирование по якорю (только на десктопе).
  useEffect(() => {
    if (!anchorRef.current) return
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (isMobile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPos(null)
      return
    }
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.max(320, rect.width),
    })
  }, [anchorRef])

  // Авто-фокус на поиск
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      role="dialog"
      aria-label="Выбор ответственного"
      className="popover-enter fixed z-[56] flex flex-col rounded-2xl overflow-hidden bg-surface
                 md:max-h-[420px] max-h-[70vh]
                 md:bottom-auto md:left-auto md:right-auto md:w-auto
                 bottom-0 left-0 right-0 w-full md:rounded-2xl rounded-t-2xl"
      style={pos
        ? { top: pos.top, left: pos.left, width: pos.width, maxWidth: 360, border: '1px solid var(--color-border-2)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }
        : { paddingBottom: 'env(safe-area-inset-bottom, 0px)', border: '1px solid var(--color-border-2)', borderBottom: 'none', boxShadow: '0 -16px 48px rgba(0,0,0,0.5)' }
      }
    >
      {/* Поиск */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <Search size={14} style={{ color: 'var(--color-text-dim)' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Поиск по имени или должности…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--color-text)' }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="text-text-dim hover:text-text transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-y-auto py-1">
        {groups.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-text-dim">Никто не найден</p>
            <p className="text-xs text-text-dim mt-1">Попробуйте изменить запрос</p>
          </div>
        )}
        {groups.map(({ role, items }) => (
          <div key={role} className="mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1 text-text-dim">
              {ROLE_LABEL[role] ?? role}
            </p>
            {items.map(emp => {
              const isSelected = emp.id === selectedId
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => onSelect(isSelected ? null : emp)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60 text-left"
                  style={{
                    background: isSelected
                      ? 'color-mix(in oklab, var(--color-green) 12%, transparent)'
                      : 'transparent',
                  }}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: isSelected
                        ? 'color-mix(in oklab, var(--color-green) 22%, transparent)'
                        : 'var(--color-surface-2)',
                      color: isSelected ? 'var(--color-green)' : 'var(--color-text-muted)',
                      border: isSelected
                        ? '1px solid color-mix(in oklab, var(--color-green) 35%, transparent)'
                        : '1px solid var(--color-border)',
                    }}
                  >
                    {emp.full_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text truncate">{emp.full_name}</p>
                    {emp.position && (
                      <p className="text-xs text-text-dim truncate">{emp.position}</p>
                    )}
                  </div>
                  {isSelected && <Check size={14} style={{ color: 'var(--color-green)' }} />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
