'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trash2, AlertCircle, Calendar, CheckSquare, Square, Filter } from 'lucide-react'
import { adminBulkDelete, adminDeleteOlderThan } from '@/lib/actions/admin'

export type AdminRecord = {
  id: string
  primary: string
  secondary?: string | null
  meta?: string | null
  badge?: { label: string; color?: string } | null
  /** Ключ для groupFilter (например, raw type 'poll' для notifications). */
  group?: string | null
}

type Table =
  | 'projects'
  | 'project_tasks'
  | 'direct_tasks'
  | 'events'
  | 'notifications'
  | 'activity_log'
  | 'polls'

export type GroupFilterOption = { value: string; label: string; color?: string }

interface Props {
  table: Table
  records: AdminRecord[]
  /** Если true — кнопка «Удалить старше N дней» показывается. */
  allowOlderThanCleanup?: boolean
  /**
   * Фильтр по значению badge. Если задан — рисует селект сверху, скрывает
   * строки с другим badge.label. Подходит для notifications (тип уведомления).
   */
  groupFilter?: GroupFilterOption[]
  /**
   * Server action для массового удаления по выбранной группе (значение из groupFilter).
   * Если задан — рисуется кнопка «Удалить все типа X» рядом с фильтром.
   */
  bulkByGroup?: (group: string) => Promise<{ ok: boolean; deleted: number; error?: string }>
}

export default function AdminRecordsTable({
  table,
  records,
  allowOlderThanCleanup = true,
  groupFilter,
  bulkByGroup,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [groupValue, setGroupValue] = useState<string>('all')
  const [olderThanDays, setOlderThanDays] = useState(30)
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter(r => {
      if (groupValue !== 'all' && r.group !== groupValue) return false
      if (q) {
        const hay = r.primary.toLowerCase()
          + ' ' + (r.secondary?.toLowerCase() ?? '')
          + ' ' + r.id.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [records, query, groupValue])

  // Сводка по группам — для подсказки рядом с селектом («poll: 1240, event: 38…»).
  const groupCounts = useMemo(() => {
    if (!groupFilter) return null
    const counts: Record<string, number> = {}
    for (const r of records) {
      const k = r.group ?? '—'
      counts[k] = (counts[k] ?? 0) + 1
    }
    return counts
  }, [records, groupFilter])

  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(r => r.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`Удалить ${selected.size} запис(ей)? Действие необратимо.`)) return
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const r = await adminBulkDelete(table, [...selected])
      if (!r.ok) setError(r.error ?? 'Не удалось удалить')
      else {
        setInfo(`Удалено: ${r.deleted}`)
        setSelected(new Set())
        router.refresh()
      }
    })
  }

  function deleteOlderThan() {
    if (!confirm(`Удалить ВСЕ записи старше ${olderThanDays} дней? Действие необратимо.`)) return
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const r = await adminDeleteOlderThan(table, olderThanDays)
      if (!r.ok) setError(r.error ?? 'Не удалось удалить')
      else {
        setInfo(`Удалено: ${r.deleted}`)
        router.refresh()
      }
    })
  }

  function deleteByGroup() {
    if (!bulkByGroup || groupValue === 'all') return
    const label = groupFilter?.find(o => o.value === groupValue)?.label ?? groupValue
    const count = groupCounts?.[groupValue] ?? 0
    if (!confirm(`Удалить ВСЕ записи группы «${label}» (${count})? Действие необратимо.`)) return
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const r = await bulkByGroup(groupValue)
      if (!r.ok) setError(r.error ?? 'Не удалось удалить')
      else {
        setInfo(`Удалено: ${r.deleted}`)
        setSelected(new Set())
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      {/* Тулбар: поиск + фильтр группы + bulk + старше N дней */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по имени, описанию или ID"
            className="input w-full"
            style={{ paddingLeft: 36 }}
          />
        </div>

        {groupFilter && (
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-text-dim shrink-0" />
            <select
              aria-label="Фильтр по типу"
              value={groupValue}
              onChange={e => { setGroupValue(e.target.value); setSelected(new Set()) }}
              className="input text-sm cursor-pointer max-w-[200px]"
            >
              <option value="all">Все типы ({records.length})</option>
              {groupFilter.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label} ({groupCounts?.[o.value] ?? 0})
                </option>
              ))}
            </select>
            {bulkByGroup && groupValue !== 'all' && (groupCounts?.[groupValue] ?? 0) > 0 && (
              <button
                type="button"
                onClick={deleteByGroup}
                disabled={busy}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                style={{
                  background: 'color-mix(in oklab, var(--color-danger) 12%, transparent)',
                  color: 'var(--color-danger)',
                  border: '1px solid color-mix(in oklab, var(--color-danger) 30%, transparent)',
                }}
                title="Удалить все записи выбранного типа"
              >
                <Trash2 size={12} />
                Удалить все
              </button>
            )}
          </div>
        )}

        {selected.size > 0 && (
          <button
            type="button"
            onClick={deleteSelected}
            disabled={busy}
            className="text-sm font-medium px-3 py-2 rounded-xl flex items-center gap-2 disabled:opacity-50"
            style={{
              background: 'color-mix(in oklab, var(--color-danger) 15%, transparent)',
              color: 'var(--color-danger)',
              border: '1px solid color-mix(in oklab, var(--color-danger) 35%, transparent)',
            }}
          >
            <Trash2 size={14} />
            Удалить выбранные ({selected.size})
          </button>
        )}

        {allowOlderThanCleanup && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-text-muted whitespace-nowrap">Старше</span>
            <input
              type="number"
              min={1}
              value={olderThanDays}
              onChange={e => setOlderThanDays(Math.max(1, Number(e.target.value) || 1))}
              className="input w-16 num"
              style={{ padding: '6px 8px', textAlign: 'center' }}
            />
            <span className="text-text-muted">дней</span>
            <button
              type="button"
              onClick={deleteOlderThan}
              disabled={busy}
              className="px-2.5 py-1.5 rounded-lg text-text-muted hover-text hover-surface flex items-center gap-1 text-xs disabled:opacity-50"
              title={`Удалить все записи старше ${olderThanDays} дней`}
            >
              <Calendar size={12} />
              Чистить
            </button>
          </div>
        )}
      </div>

      {/* Сообщения */}
      {error && (
        <div
          className="flex items-start gap-2 p-3 rounded-xl text-sm"
          style={{
            background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
            border: '1px solid color-mix(in oklab, var(--color-danger) 30%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs">×</button>
        </div>
      )}
      {info && (
        <div
          className="flex items-start gap-2 p-3 rounded-xl text-sm"
          style={{
            background: 'color-mix(in oklab, var(--color-green) 10%, transparent)',
            border: '1px solid color-mix(in oklab, var(--color-green) 30%, transparent)',
            color: 'var(--color-green)',
          }}
        >
          <CheckSquare size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1">{info}</span>
          <button onClick={() => setInfo(null)} className="text-xs">×</button>
        </div>
      )}

      {/* Таблица */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-text-muted py-12">
          {records.length === 0 ? 'Нет записей в таблице' : 'Ничего не найдено'}
        </p>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {/* Заголовок */}
          <div
            className="flex items-center gap-3 px-3 py-2 text-xs uppercase tracking-wider"
            style={{
              background: 'var(--color-surface-2)',
              borderBottom: '1px solid var(--color-border)',
              color: 'var(--color-text-dim)',
            }}
          >
            <button
              type="button"
              onClick={toggleAll}
              aria-label={allSelected ? 'Снять выделение' : 'Выделить всё'}
              className="shrink-0"
            >
              {allSelected ? <CheckSquare size={16} style={{ color: 'var(--color-green)' }} /> : <Square size={16} />}
            </button>
            <span className="flex-1">Запись</span>
            <span className="hidden sm:inline w-32 text-right">Создан</span>
            <span className="w-8" />
          </div>

          {/* Строки */}
          <ul>
            {filtered.map(r => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover-surface transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <button
                  type="button"
                  onClick={() => toggleOne(r.id)}
                  aria-label={selected.has(r.id) ? 'Снять выделение' : 'Выделить'}
                  className="shrink-0"
                >
                  {selected.has(r.id)
                    ? <CheckSquare size={16} style={{ color: 'var(--color-green)' }} />
                    : <Square size={16} style={{ color: 'var(--color-text-dim)' }} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{r.primary}</span>
                    {r.badge && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{
                          background: `color-mix(in oklab, ${r.badge.color ?? 'var(--color-text-muted)'} 15%, transparent)`,
                          color: r.badge.color ?? 'var(--color-text-muted)',
                        }}
                      >
                        {r.badge.label}
                      </span>
                    )}
                  </div>
                  {r.secondary && (
                    <p className="text-xs truncate text-text-muted mt-0.5">{r.secondary}</p>
                  )}
                  <p className="text-[10px] mt-0.5 font-mono text-text-dim">{r.id}</p>
                </div>

                <span className="hidden sm:inline w-32 text-right text-xs num text-text-dim">
                  {r.meta ?? ''}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Удалить «${r.primary}»?`)) return
                    setError(null)
                    setInfo(null)
                    startTransition(async () => {
                      const res = await adminBulkDelete(table, [r.id])
                      if (!res.ok) setError(res.error ?? 'Не удалось удалить')
                      else router.refresh()
                    })
                  }}
                  disabled={busy}
                  aria-label="Удалить"
                  className="shrink-0 p-1.5 rounded-lg text-text-dim hover-surface disabled:opacity-50"
                  style={{ color: 'var(--color-danger)' }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-text-dim">
        Всего: <span className="num">{records.length}</span> · показано: <span className="num">{filtered.length}</span>
      </p>
    </div>
  )
}
