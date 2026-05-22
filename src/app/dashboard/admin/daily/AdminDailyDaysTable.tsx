'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertCircle, CheckSquare, Square, Search } from 'lucide-react'
import { adminDeleteDailyByDates } from '@/lib/actions/admin'

export type DailyDayRow = {
  date:  string  // YYYY-MM-DD
  count: number  // сколько отчётов в этот день
}

export default function AdminDailyDaysTable({ rows }: { rows: DailyDayRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.date.includes(q) || formatDate(r.date).toLowerCase().includes(q),
    )
  }, [rows, query])

  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.date))
  const totalSelectedReports = useMemo(() => {
    let n = 0
    for (const r of rows) if (selected.has(r.date)) n += r.count
    return n
  }, [rows, selected])

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else             setSelected(new Set(filtered.map(r => r.date)))
  }

  function toggleOne(date: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  function runDelete(dates: string[], confirmMsg: string) {
    if (dates.length === 0) return
    if (!confirm(confirmMsg)) return
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const r = await adminDeleteDailyByDates(dates)
      if (!r.ok) setError(r.error ?? 'Не удалось удалить')
      else {
        setInfo(`Удалено отчётов: ${r.deleted}`)
        setSelected(new Set())
        router.refresh()
      }
    })
  }

  function deleteSelected() {
    runDelete(
      [...selected],
      `Удалить ${selected.size} ${pluralDays(selected.size)} (${totalSelectedReports} ${pluralReports(totalSelectedReports)})?\n\nДействие необратимо: вместе с отчётами удалятся их задачи и реакции.`,
    )
  }

  function deleteOne(row: DailyDayRow) {
    runDelete(
      [row.date],
      `Удалить все ${row.count} ${pluralReports(row.count)} за ${formatDate(row.date)}?\n\nДействие необратимо.`,
    )
  }

  return (
    <div className="space-y-3">
      {/* Тулбар */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по дате (например, «2026-05» или «май»)"
            className="input w-full"
            style={{ paddingLeft: 36 }}
          />
        </div>

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
            Удалить {selected.size} {pluralDays(selected.size)} ({totalSelectedReports} {pluralReports(totalSelectedReports)})
          </button>
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
          {rows.length === 0 ? 'В системе нет дейли-отчётов' : 'Ничего не найдено'}
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
            <span className="flex-1">День</span>
            <span className="w-24 text-right">Отчётов</span>
            <span className="w-8" />
          </div>

          {/* Строки */}
          <ul>
            {filtered.map(r => (
              <li
                key={r.date}
                className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 hover-surface transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <button
                  type="button"
                  onClick={() => toggleOne(r.date)}
                  aria-label={selected.has(r.date) ? 'Снять выделение' : 'Выделить'}
                  className="shrink-0"
                >
                  {selected.has(r.date)
                    ? <CheckSquare size={16} style={{ color: 'var(--color-green)' }} />
                    : <Square size={16} style={{ color: 'var(--color-text-dim)' }} />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    <span className="first-letter:uppercase">{formatDate(r.date)}</span>
                  </p>
                  <p className="text-[10px] mt-0.5 font-mono text-text-dim">{r.date}</p>
                </div>

                <span
                  className="w-24 text-right text-sm font-semibold num"
                  style={{ color: r.count > 0 ? 'var(--color-info)' : 'var(--color-text-dim)' }}
                >
                  {r.count}
                </span>

                <button
                  type="button"
                  onClick={() => deleteOne(r)}
                  disabled={busy}
                  aria-label={`Удалить отчёты за ${formatDate(r.date)}`}
                  className="shrink-0 p-1.5 rounded-lg hover-surface disabled:opacity-50"
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
        Всего дней: <span className="num">{rows.length}</span> · показано: <span className="num">{filtered.length}</span>
      </p>
    </div>
  )
}

// «Суббота, 23 мая 2026»
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Oral',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function pluralDays(n: number): string {
  const last = n % 10
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'дней'
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дня'
  return 'дней'
}

function pluralReports(n: number): string {
  const last = n % 10
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'отчётов'
  if (last === 1) return 'отчёт'
  if (last >= 2 && last <= 4) return 'отчёта'
  return 'отчётов'
}
