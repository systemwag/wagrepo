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

/**
 * TZ-safe сдвиг даты-строки YYYY-MM-DD на N календарных дней.
 * Возвращает YYYY-MM-DD; знак deltaDays — направление (отриц. = в прошлое).
 *
 * NB: НЕ ИСПОЛЬЗОВАТЬ `new Date('YYYY-MM-DDT00:00:00')` для арифметики над
 * датами. Такая строка парсится как ЛОКАЛЬНОЕ время среды, а `toISOString()`
 * возвращает UTC — в любой TZ ≠ UTC это даёт «утечку» дня (на Asia/Oral
 * `shiftDate("2026-05-23", -1)` отдавал "2026-05-21" вместо "2026-05-22").
 *
 * Тут работаем целиком в UTC через Date.UTC + setUTCDate — результат
 * одинаков на сервере и в браузере, в любой TZ окружения.
 */
export function shiftDateStr(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().split('T')[0]
}
