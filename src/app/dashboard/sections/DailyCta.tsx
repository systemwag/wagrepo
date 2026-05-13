import Link from 'next/link'
import { CheckCircle2, FileText } from 'lucide-react'
import { hasMyDailyToday } from '../queries'
import { currentHourOral } from '@/lib/utils/date'

/**
 * Промптит сотрудника подать дейли-отчёт.
 * Если уже подан — показывает «Спасибо» (не назойливо).
 * После 17:00 если не подан — становится критичным алертом.
 */
export default async function DailyCta({ userId }: { userId: string }) {
  const submitted = await hasMyDailyToday(userId)
  const hour = currentHourOral()
  const isLate = !submitted && hour >= 17

  if (submitted) {
    return (
      <Link
        href="/dashboard/daily"
        className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors"
        style={{
          background: 'color-mix(in oklab, var(--color-green) 8%, transparent)',
          borderColor: 'color-mix(in oklab, var(--color-green) 25%, transparent)',
          color: 'var(--color-green)',
        }}
      >
        <CheckCircle2 size={16} className="shrink-0" />
        <p className="text-sm font-medium">Дейли-отчёт за сегодня подан</p>
        <span className="ml-auto text-xs opacity-75">Изменить →</span>
      </Link>
    )
  }

  return (
    <Link
      href="/dashboard/daily"
      className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors"
      style={{
        background: isLate
          ? 'color-mix(in oklab, var(--color-danger) 8%, transparent)'
          : 'color-mix(in oklab, var(--color-info) 8%, transparent)',
        borderColor: isLate
          ? 'color-mix(in oklab, var(--color-danger) 25%, transparent)'
          : 'color-mix(in oklab, var(--color-info) 25%, transparent)',
        color: isLate ? 'var(--color-danger)' : 'var(--color-info)',
      }}
    >
      <FileText size={16} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {isLate ? 'Не забудь подать дейли — день уже к концу' : 'Подайте дейли-отчёт за сегодня'}
        </p>
        <p className="text-xs opacity-80 truncate">Что сделано, план на завтра, блокеры</p>
      </div>
      <span className="text-xs">→</span>
    </Link>
  )
}
