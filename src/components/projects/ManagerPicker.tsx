'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, X, ChevronDown, Check, UserCog } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'

export type Employee = {
  id: string
  full_name: string
  position: string | null
  role?: 'admin' | 'director' | 'manager' | 'employee' | string | null
}

const ROLE_ORDER: Record<string, number> = {
  admin: 0, director: 1, manager: 2, employee: 3,
}

interface Props {
  employees: Employee[]
  /** Пустая строка = по умолчанию (текущий пользователь). */
  value: string
  onChange: (value: string) => void
  currentUserId: string
}

export default function ManagerPicker({ employees, value, onChange, currentUserId }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Закрываем по Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Если ничего не выбрано — показываем текущего пользователя как default
  const effectiveId = value || currentUserId
  const selected = employees.find(e => e.id === effectiveId)

  // Сортируем по ролям (директор сверху), потом по имени
  const sorted = useMemo(() => {
    return employees.slice().sort((a, b) => {
      const ra = ROLE_ORDER[a.role ?? 'employee'] ?? 99
      const rb = ROLE_ORDER[b.role ?? 'employee'] ?? 99
      if (ra !== rb) return ra - rb
      return a.full_name.localeCompare(b.full_name, 'ru')
    })
  }, [employees])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      (e.position?.toLowerCase().includes(q) ?? false)
    )
  }, [sorted, query])

  function pick(id: string) {
    // id === currentUserId — обнуляем в '', чтобы сервер знал «по умолчанию» (для backward compat)
    onChange(id === currentUserId ? '' : id)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="input w-full text-left flex items-center gap-3"
        style={{ padding: '10px 12px' }}
      >
        <Avatar name={selected?.full_name ?? '?'} highlighted />
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                {selected.full_name}
                {selected.id === currentUserId && (
                  <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>(вы)</span>
                )}
              </div>
              {selected.position && (
                <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {selected.position}
                </div>
              )}
            </>
          ) : (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Выбрать менеджера</span>
          )}
        </div>
        <ChevronDown size={16} style={{ color: 'var(--text-dim)' }} />
      </button>

      {open && (
        <Portal>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100]"
            style={{ background: 'color-mix(in oklab, black 60%, transparent)' }}
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Sheet */}
          <div
            className="fixed z-[101] flex flex-col
                       left-0 right-0 bottom-0 max-h-[85vh] rounded-t-2xl
                       sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                       sm:w-[440px] sm:max-h-[80vh] sm:rounded-2xl
                       animate-fade-up"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'color-mix(in oklab, var(--color-green) 15%, transparent)',
                  color: 'var(--color-green)',
                }}
              >
                <UserCog size={16} strokeWidth={1.8} />
              </div>
              <h3 className="text-base font-semibold flex-1" style={{ color: 'var(--text)' }}>
                Менеджер проекта
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="p-2 -m-2 rounded-lg hover-surface"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div
              className="px-4 py-3 border-b shrink-0"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-dim)' }}
                />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Поиск по имени или должности"
                  className="input w-full"
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  Никого не нашлось
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map(emp => {
                    const isSelected = emp.id === effectiveId
                    const isYou = emp.id === currentUserId
                    return (
                      <li key={emp.id}>
                        <button
                          type="button"
                          onClick={() => pick(emp.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                          style={{
                            background: isSelected
                              ? 'color-mix(in oklab, var(--color-green) 12%, transparent)'
                              : 'transparent',
                            border: `1px solid ${isSelected ? 'color-mix(in oklab, var(--color-green) 30%, transparent)' : 'transparent'}`,
                          }}
                        >
                          <Avatar name={emp.full_name} highlighted={isSelected} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                              {emp.full_name}
                              {isYou && (
                                <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>(вы)</span>
                              )}
                            </div>
                            {emp.position && (
                              <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {emp.position}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <Check size={18} style={{ color: 'var(--color-green)' }} />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}

function Avatar({ name, highlighted }: { name: string; highlighted: boolean }) {
  const letter = name.charAt(0).toUpperCase() || '?'
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{
        background: highlighted
          ? 'color-mix(in oklab, var(--color-green) 22%, transparent)'
          : 'var(--color-surface-2)',
        color: highlighted ? 'var(--color-green)' : 'var(--color-text-muted)',
      }}
    >
      {letter}
    </div>
  )
}
