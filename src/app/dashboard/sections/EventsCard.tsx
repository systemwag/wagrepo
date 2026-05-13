import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { Card, CardHeader, CardEmpty } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { todayOral, todayStringOral } from '@/lib/utils/date'
import { getUpcomingEvents } from '../queries'

const IMPORTANCE_COLOR: Record<string, string> = {
  low:      'var(--color-info)',
  medium:   'var(--color-warn)',
  high:     '#fb923c',
  critical: 'var(--color-danger)',
}

export default async function EventsCard() {
  const events = await getUpcomingEvents()
  const todayStr = todayStringOral()
  const todayTs = todayOral().getTime()

  return (
    <Card>
      <CardHeader
        icon={<CalendarDays size={18} />}
        title="Ближайшие мероприятия"
        count={events.length}
        action={
          <Link href="/dashboard/events" className="text-xs hover-green text-text-dim">
            Все →
          </Link>
        }
      />
      {events.length > 0 ? (
        <div>
          {events.map((ev, i) => {
            const evDate   = new Date(ev.date + 'T00:00:00')
            const isToday  = ev.date === todayStr
            const daysDiff = Math.round((evDate.getTime() - todayTs) / 86400000)
            const color    = IMPORTANCE_COLOR[ev.importance] ?? 'var(--color-warn)'
            return (
              <Link
                key={ev.id}
                href="/dashboard/events"
                className="flex items-center gap-3 px-4 py-3 @md:px-6 row-hover"
                style={{ borderBottom: i < events.length - 1 ? '1px solid var(--color-border)' : undefined }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-text">{ev.title}</p>
                  <p className="text-xs truncate mt-0.5 text-text-dim">
                    <span className="num">{evDate.toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })}</span>
                    {ev.start_time && <> · <span className="num">{ev.start_time.slice(0, 5)}</span></>}
                    {ev.location   && <span className="hidden @sm:inline"> · {ev.location}</span>}
                  </p>
                </div>
                <div className="shrink-0">
                  {isToday
                    ? <Badge tone="warn">Сегодня</Badge>
                    : <Badge tone="neutral">
                        <span className="hidden @xs:inline">через </span>
                        <span className="num">{daysDiff}</span>
                        <span className="hidden @sm:inline"> {daysDiff === 1 ? 'день' : daysDiff < 5 ? 'дня' : 'дней'}</span>
                        <span className="@sm:hidden">д.</span>
                      </Badge>}
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <CardEmpty compact icon={<CalendarDays size={20} />} text="Мероприятий в ближайшие 14 дней нет" />
      )}
    </Card>
  )
}
