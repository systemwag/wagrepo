'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Check } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'

// ─────────────────────────────────────────────────────────────────────────────
// Переиспользуемый пикер сотрудников с поиском и группировкой по ролям.
// Поддерживает mode='single' (мгновенное применение) и mode='multi' (с явной
// кнопкой «Готово»).
//
// TODO: src/components/planning/stage/AssigneePicker.tsx — единственный
// текущий потребитель single — пока не перевели на этот компонент. Если
// будете трогать его — заверните на эту базу, чтобы код был один.
// ─────────────────────────────────────────────────────────────────────────────

export type PickerEmployee = {
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

type CommonProps = {
  anchorRef: React.RefObject<HTMLElement | null>
  employees: PickerEmployee[]
  onClose: () => void
  ariaLabel?: string
}

type Props =
  | (CommonProps & {
      mode: 'single'
      selectedId: string | null
      onSelect: (emp: PickerEmployee | null) => void
    })
  | (CommonProps & {
      mode: 'multi'
      selectedIds: string[]
      /** Срабатывает при клике «Готово». Передаётся итоговый набор id. */
      onConfirm: (ids: string[]) => void
    })

export default function EmployeePickerPanel(props: Props) {
  const { anchorRef, employees, onClose, ariaLabel } = props
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Локальный буфер multi — позволяет тыкать чек-марки без сетевого вызова.
  const [draftIds, setDraftIds] = useState<Set<string>>(
    props.mode === 'multi' ? new Set(props.selectedIds) : new Set(),
  )

  // Закрытие по Escape (обработчик на window живёт пока панель открыта).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Позиционирование по якорю (только десктоп).
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

  // Автофокус на поиск
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  const groups = filterAndGroup(employees, query)

  function isSelected(id: string): boolean {
    if (props.mode === 'single') return props.selectedId === id
    return draftIds.has(id)
  }

  function handleClick(emp: PickerEmployee) {
    if (props.mode === 'single') {
      props.onSelect(props.selectedId === emp.id ? null : emp)
      onClose()
      return
    }
    setDraftIds(prev => {
      const next = new Set(prev)
      if (next.has(emp.id)) next.delete(emp.id)
      else next.add(emp.id)
      return next
    })
  }

  function handleConfirm() {
    if (props.mode !== 'multi') return
    props.onConfirm([...draftIds])
    onClose()
  }

  return (
    <Portal lockScroll={false}>
      {/* Catcher для клика мимо + мобильное затемнение */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[55] md:bg-transparent bg-black/45 md:backdrop-blur-0 backdrop-blur-[2px]"
        aria-hidden
      />

      <div
        role="dialog"
        aria-label={ariaLabel ?? 'Выбор сотрудников'}
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
            onChange={e => setQuery(e.target.value)}
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
                const sel = isSelected(emp.id)
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleClick(emp)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60 text-left"
                    style={{
                      background: sel
                        ? 'color-mix(in oklab, var(--color-green) 12%, transparent)'
                        : 'transparent',
                    }}
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: sel
                          ? 'color-mix(in oklab, var(--color-green) 22%, transparent)'
                          : 'var(--color-surface-2)',
                        color: sel ? 'var(--color-green)' : 'var(--color-text-muted)',
                        border: sel
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
                    {sel && <Check size={14} style={{ color: 'var(--color-green)' }} />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Футер «Готово» — только в multi-режиме */}
        {props.mode === 'multi' && (
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-xs text-text-dim">
              Выбрано: <span className="num font-medium text-text">{draftIds.size}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs px-3 py-1.5 rounded-lg text-text-dim hover:text-text"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{
                  background: 'var(--green-glow)',
                  color: 'var(--green)',
                  border: '1px solid color-mix(in oklab, var(--color-green) 30%, transparent)',
                }}
              >
                Готово
              </button>
            </div>
          </div>
        )}
      </div>
    </Portal>
  )
}

function filterAndGroup(employees: PickerEmployee[], query: string) {
  const q = query.trim().toLowerCase()
  const filtered = q
    ? employees.filter(e =>
        e.full_name.toLowerCase().includes(q) ||
        (e.position ?? '').toLowerCase().includes(q),
      )
    : employees

  const byRole = new Map<string, PickerEmployee[]>()
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
