'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { useIsMobile } from '@/lib/hooks/useMediaQuery'

// ─────────────────────────────────────────────────────────────────────────────
// Popup-only календарь в стиле проекта. То же UX, что у DatePicker (mobile
// bottom-sheet + desktop absolute pop), но БЕЗ собственного trigger —
// родитель сам решает чем триггерить (кнопкой, чипом и т.д.) и управляет
// open через onClose.
//
// Создан для inline-использования в строке чек-листа, где нативный date-input
// смотрится чужеродно и не следует дизайну.
// ─────────────────────────────────────────────────────────────────────────────

const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const RU_DAYS   = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

type Props = {
  value: string | null              // YYYY-MM-DD или null
  onChange: (v: string | null) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  accentColor?: string
  ariaLabel?: string
}

export default function DatePickerPopover({
  value, onChange, onClose, anchorRef, accentColor, ariaLabel,
}: Props) {
  const today  = new Date()
  // Парсим как UTC midnight — для отображения и навигации это даёт ту же
  // календарную дату, не зависящую от пользовательской TZ.
  const parsed = value ? new Date(value + 'T00:00:00Z') : null

  const [viewYear, setViewYear]   = useState(parsed?.getUTCFullYear()  ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getUTCMonth()     ?? today.getMonth())
  const isMobile = useIsMobile()
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Закрытие по Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Позиционирование по якорю (только десктоп).
  useEffect(() => {
    if (isMobile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPos(null)
      return
    }
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 8, left: rect.left })
  }, [anchorRef, isMobile])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(iso)
    onClose()
  }

  // Сетка Пн-Вс
  const firstDow  = new Date(viewYear, viewMonth, 1).getDay()
  const offset    = firstDow === 0 ? 6 : firstDow - 1
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isToday    = (d: number) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
  const isSelected = (d: number) => !!(parsed && d === parsed.getUTCDate() && viewMonth === parsed.getUTCMonth() && viewYear === parsed.getUTCFullYear())

  const accent     = accentColor ?? 'var(--green)'
  const accentGlow = accentColor ? `${accentColor}22` : 'var(--green-glow)'

  const body = (
    <>
      {/* Навигация месяц/год */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
          aria-label="Предыдущий месяц"
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
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
          aria-label="Следующий месяц"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Заголовки дней */}
      <div className="grid grid-cols-7 mb-2">
        {RU_DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold py-1"
            style={{ color: d === 'Сб' || d === 'Вс' ? 'rgba(99,102,241,0.7)' : 'var(--text-dim)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Ячейки */}
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

      {/* Футер */}
      <div className="mt-3 pt-3 flex justify-between items-center" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => { onChange(null); onClose() }}
          className="text-xs px-3 py-2 rounded-lg transition-colors"
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
          className="text-xs px-3 py-2 rounded-lg font-medium transition-colors"
          style={{ color: accent, background: accentGlow }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        >
          Сегодня
        </button>
      </div>
    </>
  )

  return (
    <Portal>
      {/* Overlay-catcher: на десктопе прозрачный, на мобильном dim */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] md:bg-transparent bg-black/45 md:backdrop-blur-0 backdrop-blur-[2px]"
        aria-hidden
      />

      {isMobile ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={ariaLabel ?? 'Выбор даты'}
          className="fixed left-0 right-0 bottom-0 z-[101] rounded-t-3xl p-4"
          style={{
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
            borderBottom: 'none',
            boxShadow: '0 -16px 48px rgba(0,0,0,0.65)',
            maxHeight: '90dvh',
            overflowY: 'auto',
          }}
        >
          <div className="mx-auto w-10 h-1 rounded-full mb-3" style={{ background: 'var(--border-2)' }} />
          {body}
        </div>
      ) : (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={ariaLabel ?? 'Выбор даты'}
          className="fixed z-[101] rounded-2xl p-4"
          style={{
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            minWidth: 320,
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          {body}
        </div>
      )}
    </Portal>
  )
}
