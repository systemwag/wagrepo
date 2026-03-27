/**
 * Временная зона WAG System — Орал, Казахстан (UTC+5)
 */
export const TZ = 'Asia/Oral'

/**
 * Возвращает строку YYYY-MM-DD для сегодняшнего дня в часовом поясе Орал.
 * Используй вместо new Date().toISOString().split('T')[0] на сервере.
 */
export function todayStringOral(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Возвращает объект Date, соответствующий началу сегодняшнего дня (00:00:00) по Оралу.
 * Используй вместо new Date().setHours(0,0,0,0) — тот даёт UTC-полночь.
 */
export function todayOral(): Date {
  return new Date(todayStringOral() + 'T00:00:00')
}

/**
 * Текущий час в часовом поясе Орал (0–23).
 * Используй вместо new Date().getHours() на сервере.
 */
export function currentHourOral(): number {
  return parseInt(
    new Intl.DateTimeFormat('en', {
      timeZone: TZ,
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10,
  )
}
