'use client'

import { useState, useRef, useEffect } from 'react'
import { Clock, X } from 'lucide-react'

const HOURS   = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5) // 0,5,10,...,55

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function TimePicker({
  value,
  onChange,
  placeholder = '--:--',
}: {
  value: string        // 'HH:MM' or ''
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref     = useRef<HTMLDivElement>(null)
  const hourRef = useRef<HTMLDivElement>(null)
  const minRef  = useRef<HTMLDivElement>(null)

  const parts   = value ? value.split(':') : []
  const selH    = parts[0] !== undefined ? parseInt(parts[0]) : null
  const selM    = parts[1] !== undefined ? parseInt(parts[1]) : null
  // Closest 5-min slot for display
  const selMSlot = selM !== null ? MINUTES.reduce((a, b) => Math.abs(b - selM) < Math.abs(a - selM) ? b : a) : null

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Scroll selected items into view on open
  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      if (hourRef.current && selH !== null) {
        const el = hourRef.current.children[selH] as HTMLElement | undefined
        el?.scrollIntoView({ block: 'center', behavior: 'instant' })
      }
      if (minRef.current && selMSlot !== null) {
        const idx = MINUTES.indexOf(selMSlot)
        if (idx !== -1) {
          const el = minRef.current.children[idx] as HTMLElement | undefined
          el?.scrollIntoView({ block: 'center', behavior: 'instant' })
        }
      }
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickH = (h: number) => onChange(`${pad2(h)}:${pad2(selM ?? 0)}`)
  const pickM = (m: number) => onChange(`${pad2(selH ?? 0)}:${pad2(m)}`)

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input w-full flex items-center justify-between gap-2 text-left"
      >
        <span style={{ color: value ? 'var(--text)' : 'var(--text-dim)' }}>
          {value || placeholder}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {value && (
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
          <Clock className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 rounded-2xl overflow-hidden"
          style={{
            top: 'calc(100% + 6px)',
            left: 0,
            width: '100%',
            minWidth: 140,
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
          }}
        >
          {/* Column headers */}
          <div
            className="grid grid-cols-2 text-center"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)', borderRight: '1px solid var(--border)' }}>
              Часы
            </span>
            <span className="py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
              Минуты
            </span>
          </div>

          <div className="flex" style={{ maxHeight: 200 }}>
            {/* Hours */}
            <div
              ref={hourRef}
              className="flex-1 overflow-y-auto"
              style={{ borderRight: '1px solid var(--border)', scrollbarWidth: 'none' }}
            >
              {HOURS.map(h => {
                const sel = selH === h
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => pickH(h)}
                    className="w-full text-center py-1.5 text-sm font-medium transition-colors"
                    style={{
                      background: sel ? 'var(--green-glow)' : 'transparent',
                      color:      sel ? 'var(--green)'      : 'var(--text)',
                      fontWeight: sel ? 700 : 400,
                    }}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {pad2(h)}
                  </button>
                )
              })}
            </div>

            {/* Minutes */}
            <div
              ref={minRef}
              className="flex-1 overflow-y-auto"
              style={{ scrollbarWidth: 'none' }}
            >
              {MINUTES.map(m => {
                const sel = selMSlot === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickM(m)}
                    className="w-full text-center py-1.5 text-sm font-medium transition-colors"
                    style={{
                      background: sel ? 'var(--green-glow)' : 'transparent',
                      color:      sel ? 'var(--green)'      : 'var(--text)',
                      fontWeight: sel ? 700 : 400,
                    }}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {pad2(m)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Clear footer */}
          {value && (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="w-full text-xs py-2 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                Очистить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
