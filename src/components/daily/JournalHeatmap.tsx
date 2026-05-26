'use client'

import { useMemo, useState } from 'react'

type DayStat = {
  date:       string  // YYYY-MM-DD
  reports:    number  // сколько отчётов сдали
  hours:      number  // сумма часов
  blockers:   number  // сколько отчётов с блокером
  isToday:    boolean
  isYesterday:boolean
}

// ── Градация насыщенности по сумме часов команды ─────────────────────────────
// Лёгкий, но информативный visual: фон чем темнее — тем больше часов в этот
// день. 0 часов = пустая серая ячейка, без glow.
function intensity(hours: number): { opacity: number; glow: string } {
  if (hours <= 0)   return { opacity: 0,    glow: 'none' }
  if (hours < 20)   return { opacity: 0.3,  glow: 'none' }
  if (hours < 50)   return { opacity: 0.55, glow: 'none' }
  if (hours < 100)  return { opacity: 0.8,  glow: '0 0 4px rgba(34,197,94,0.25)' }
  if (hours < 150)  return { opacity: 0.95, glow: '0 0 6px rgba(34,197,94,0.4)' }
  return              { opacity: 1,    glow: '0 0 10px rgba(34,197,94,0.55)' }
}

function formatTooltip(stat: DayStat): string {
  const d = new Date(stat.date + 'T00:00:00')
  const label = d.toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Oral', weekday: 'short', day: 'numeric', month: 'short',
  })
  const parts = [label]
  if (stat.reports === 0) parts.push('нет отчётов')
  else                    parts.push(`${stat.reports} ${plural(stat.reports, ['отчёт','отчёта','отчётов'])}`)
  if (stat.hours > 0)     parts.push(`${stat.hours}ч`)
  if (stat.blockers > 0)  parts.push(`${stat.blockers} ${plural(stat.blockers, ['блокер','блокера','блокеров'])}`)
  return parts.join(' · ')
}

function plural(n: number, forms: [string, string, string]): string {
  const last = n % 10
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2]
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}

export default function JournalHeatmap({ stats }: { stats: DayStat[] }) {
  // stats приходит в порядке свежие→старые (так же, как лента).
  // В полосе хочется обратное: старые→свежие, как чтение слева направо.
  const ordered = useMemo(() => [...stats].reverse(), [stats])
  const [hover, setHover] = useState<DayStat | null>(null)

  // Полоса на мобильном уезжает в горизонтальный скролл — на 60 ячейках
  // даже при ширине 14px это ~840px, что не влезет в портретный экран.
  // На desktop ячейки тянутся flex'ом до ширины контейнера.

  function scrollToDay(date: string) {
    const el = document.getElementById(`day-${date}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (ordered.length === 0) return null

  return (
    <div className="p-3 rounded-2xl space-y-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          Полоса активности · {ordered.length} {plural(ordered.length, ['день','дня','дней'])}
        </p>
        <p className="text-[11px] num" style={{ color: 'var(--text-dim)' }}>
          {hover ? formatTooltip(hover) : 'наведи / тапни ячейку'}
        </p>
      </div>

      <div
        className="overflow-x-auto -mx-1 px-1 scroll-x-hidden"
        style={{
          maskImage: 'linear-gradient(to right, black 0, black calc(100% - 24px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, black 0, black calc(100% - 24px), transparent 100%)',
        }}
      >
        <div className="flex items-stretch gap-[3px] min-w-min">
          {ordered.map(stat => {
            const { opacity, glow } = intensity(stat.hours)
            return (
              <button
                key={stat.date}
                onMouseEnter={() => setHover(stat)}
                onMouseLeave={() => setHover(h => h?.date === stat.date ? null : h)}
                onClick={() => { setHover(stat); scrollToDay(stat.date) }}
                title={formatTooltip(stat)}
                className="relative flex-1 rounded-md transition-all"
                style={{
                  minWidth: 14,
                  height: 32,
                  background: stat.reports === 0
                    ? 'var(--surface-2)'
                    : `color-mix(in oklab, var(--color-green) ${Math.round(opacity * 100)}%, var(--surface-2))`,
                  boxShadow: glow,
                  border: stat.isToday
                    ? '1.5px solid var(--color-green)'
                    : stat.isYesterday
                      ? '1px solid color-mix(in oklab, var(--color-info) 50%, transparent)'
                      : hover?.date === stat.date
                        ? '1px solid var(--text-dim)'
                        : '1px solid transparent',
                }}
              >
                {/* Маркер блокера в углу ячейки */}
                {stat.blockers > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full flex items-center justify-center"
                    style={{
                      background: '#f87171',
                      border: '1.5px solid var(--surface)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Подпись-легенда — компактно, для понимания шкалы */}
      <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-dim)' }}>
        <span>раньше →</span>
        <div className="flex items-center gap-1.5">
          <span>0ч</span>
          {[0.2, 0.45, 0.7, 1].map(o => (
            <span key={o} className="w-2.5 h-2.5 rounded-sm"
              style={{ background: `color-mix(in oklab, var(--color-green) ${Math.round(o*100)}%, var(--surface-2))` }} />
          ))}
          <span>150ч+</span>
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: '#f87171' }} />
            блокер
          </span>
        </div>
        <span>← сегодня</span>
      </div>
    </div>
  )
}

export type { DayStat }
