'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check as CheckIcon, Search, User } from 'lucide-react'
import { sortEmployeesByRole, type AssigneeRef, type Employee, type Stage } from './_shared'

interface Props {
  stage: Stage
  employees: Employee[]
  canManage: boolean
  stageColor: string
  /** Сохранить полный список ответственных. */
  onSave: (stageId: string, profileIds: string[]) => Promise<void> | void
}

const ROLE_LABEL: Record<string, string> = {
  admin:    'Admin',
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}

export default function StageAssignee({ stage, employees, canManage, stageColor, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const assignees = stage.assignees ?? []

  // Локальный набор выбранных (синхронизируется со stage при открытии)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(assignees.map(a => a.id)))
  const [saving, setSaving] = useState(false)

  // Когда меняется stage снаружи — обновляем локальный набор
  useEffect(() => {
    if (!open) setSelected(new Set(assignees.map(a => a.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id, assignees.length])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) && open) {
        // При клике вне popup — сохраняем если есть изменения, иначе закрываем
        commitOnClose()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected])

  async function commitOnClose() {
    const original = new Set(assignees.map(a => a.id))
    const changed = original.size !== selected.size
      || [...selected].some(id => !original.has(id))

    if (!changed) {
      setOpen(false)
      return
    }
    setSaving(true)
    await onSave(stage.id, [...selected])
    setSaving(false)
    setOpen(false)
  }

  const sorted = useMemo(() => sortEmployeesByRole(employees), [employees])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      (e.position?.toLowerCase().includes(q) ?? false),
    )
  }, [sorted, query])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Если назначений нет и пользователь не может управлять — ничего не показываем
  if (!canManage && assignees.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => canManage && setOpen(o => !o)}
        className="flex items-center gap-2 rounded-xl px-2 py-1 transition-colors text-sm"
        style={{ cursor: canManage ? 'pointer' : 'default' }}
      >
        {assignees.length > 0 ? (
          <AvatarGroup people={assignees} stageColor={stageColor} max={3} />
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>
            <User size={14} className="inline mr-1" />+ Ответственные
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-72 rounded-xl z-20 overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {/* Поиск */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-dim)' }}
              />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск"
                className="input w-full text-sm"
                style={{ paddingLeft: 28, paddingTop: 6, paddingBottom: 6 }}
              />
            </div>
          </div>

          {/* Список — группирован по ролям */}
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-6">Никого не нашлось</p>
            ) : (
              <GroupedList items={filtered} selected={selected} onToggle={toggle} stageColor={stageColor} />
            )}
          </div>

          {/* Footer */}
          <div
            className="px-3 py-2 border-t flex items-center justify-between text-xs"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="text-text-dim">
              Выбрано: <span className="num font-medium" style={{ color: 'var(--text)' }}>{selected.size}</span>
            </span>
            <button
              type="button"
              onClick={commitOnClose}
              disabled={saving}
              className="text-sm font-medium px-3 py-1.5 rounded-lg"
              style={{
                background: 'var(--color-green)',
                color: '#040d07',
              }}
            >
              {saving ? '…' : 'Готово'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AvatarGroup ──────────────────────────────────────────────────────────

export function AvatarGroup({
  people,
  stageColor,
  max = 3,
  size = 24,
}: {
  people: AssigneeRef[]
  stageColor: string
  max?: number
  size?: number
}) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p, i) => (
        <div
          key={p.id}
          title={p.full_name}
          className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
          style={{
            width: size,
            height: size,
            fontSize: size <= 24 ? 10 : 12,
            background: stageColor + '22',
            color: stageColor,
            border: `1.5px solid ${stageColor}44`,
            zIndex: shown.length - i,
            // outline через ring чтобы соседи не «склеивались»
            boxShadow: '0 0 0 2px var(--color-surface)',
          }}
        >
          {p.full_name.charAt(0).toUpperCase()}
        </div>
      ))}
      {rest > 0 && (
        <div
          className="rounded-full flex items-center justify-center font-semibold num text-text-muted"
          style={{
            width: size,
            height: size,
            fontSize: size <= 24 ? 10 : 12,
            background: 'var(--color-surface-2)',
            border: '1.5px solid var(--color-border-2)',
            boxShadow: '0 0 0 2px var(--color-surface)',
          }}
        >
          +{rest}
        </div>
      )}
    </div>
  )
}

// ─── GroupedList: внутри popover, группировка по ролям ─────────────────────

function GroupedList({
  items,
  selected,
  onToggle,
  stageColor,
}: {
  items: Employee[]
  selected: Set<string>
  onToggle: (id: string) => void
  stageColor: string
}) {
  // Группируем по роли
  const groups = useMemo(() => {
    const map = new Map<string, Employee[]>()
    for (const emp of items) {
      const role = (emp.role ?? 'employee') as string
      const arr = map.get(role) ?? []
      arr.push(emp)
      map.set(role, arr)
    }
    // Возвращаем в нужном порядке ролей
    return ['admin', 'director', 'manager', 'employee']
      .filter(role => map.has(role))
      .map(role => ({ role, items: map.get(role)! }))
  }, [items])

  return (
    <>
      {groups.map(({ role, items: empsInRole }) => (
        <div key={role} className="py-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1 text-text-dim">
            {ROLE_LABEL[role] ?? role}
          </p>
          {empsInRole.map(emp => {
            const checked = selected.has(emp.id)
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => onToggle(emp.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                style={{
                  background: checked ? `color-mix(in oklab, ${stageColor} 10%, transparent)` : 'transparent',
                }}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{
                    background: checked ? stageColor : 'var(--color-surface-2)',
                    border: `1px solid ${checked ? stageColor : 'var(--color-border)'}`,
                  }}
                >
                  {checked && <CheckIcon size={10} style={{ color: '#040d07' }} />}
                </div>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                  style={{
                    background: checked ? stageColor + '22' : 'var(--color-surface-2)',
                    color: checked ? stageColor : 'var(--color-text-muted)',
                  }}
                >
                  {emp.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{emp.full_name}</p>
                  {emp.position && (
                    <p className="text-xs truncate text-text-dim">{emp.position}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </>
  )
}

