'use client'

import { useState, useRef, useEffect } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const RU_DAYS   = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

export default function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  accentColor,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  accentColor?: string
}) {
  const today  = new Date()
  const parsed = value ? new Date(value + 'T00:00:00') : null
  const [open, setOpen]           = useState(false)
  const [viewYear, setViewYear]   = useState(parsed?.getFullYear()  ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth()     ?? today.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])


  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day)
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    onChange(iso)
    setOpen(false)
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  // Build Mon-first calendar grid
  const firstDow  = new Date(viewYear, viewMonth, 1).getDay()
  const offset    = firstDow === 0 ? 6 : firstDow - 1
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const displayValue = parsed
    ? parsed.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

  const isToday    = (d: number) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
  const isSelected = (d: number) => !!(parsed && d === parsed.getDate() && viewMonth === parsed.getMonth() && viewYear === parsed.getFullYear())

  const accent = accentColor ?? 'var(--green)'
  const accentGlow = accentColor ? `${accentColor}22` : 'var(--green-glow)'

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        className="input w-full flex items-center justify-between gap-2 text-left"
        style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}
      >
        <span style={{ color: displayValue ? 'var(--text)' : 'var(--text-dim)' }}>
          {displayValue || placeholder || 'Выберите дату'}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {value && !disabled && (
            <span
              onClick={clear}
              className="p-0.5 rounded transition-colors"
              style={{ color: 'var(--text-dim)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <CalendarDays className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 rounded-2xl p-4"
          style={{
            top: 'calc(100% + 8px)',
            left: 0,
            minWidth: '320px',
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
          }}
        >
          {/* Month / year navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <select
                value={viewMonth}
                onChange={e => setViewMonth(Number(e.target.value))}
                className="text-sm font-semibold bg-transparent border-none outline-none cursor-pointer"
                style={{ color: 'var(--text)' }}
              >
                {RU_MONTHS.map((m, i) => (
                  <option key={i} value={i} style={{ background: 'var(--surface)' }}>{m}</option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={e => setViewYear(Number(e.target.value))}
                className="text-sm font-semibold bg-transparent border-none outline-none cursor-pointer"
                style={{ color: 'var(--text)' }}
              >
                {Array.from({ length: 20 }, (_, i) => today.getFullYear() - 5 + i).map(y => (
                  <option key={y} value={y} style={{ background: 'var(--surface)' }}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-2">
            {RU_DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold py-1"
                style={{ color: d === 'Сб' || d === 'Вс' ? 'rgba(99,102,241,0.7)' : 'var(--text-dim)' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />
              const sel = isSelected(day)
              const tod = isToday(day)
              const col = idx % 7
              const isWeekend = col === 5 || col === 6
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDay(day)}
                  className="w-full aspect-square rounded-xl text-sm font-medium flex items-center justify-center transition-all"
                  style={{
                    background: sel ? accent : tod ? accentGlow : 'transparent',
                    color: sel ? '#000' : tod ? accent : isWeekend ? 'rgba(99,102,241,0.8)' : 'var(--text)',
                    fontWeight: sel || tod ? 700 : 400,
                    border: tod && !sel ? `1px solid ${accent}66` : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = tod ? accentGlow : 'transparent' }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 flex justify-between items-center" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            >
              Очистить
            </button>
            <button
              type="button"
              onClick={() => {
                setViewYear(today.getFullYear())
                setViewMonth(today.getMonth())
                selectDay(today.getDate())
              }}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ color: accent, background: accentGlow }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
