import { Cake } from 'lucide-react'
import { Card, CardHeader, CardEmpty } from '@/components/ui/Card'
import { Badge, BadgeSolid } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { getUpcomingBirthdays } from '../queries'

const roleLabel: Record<string, string> = {
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}

export default async function BirthdaysCard() {
  const birthdays = await getUpcomingBirthdays(30)

  return (
    <Card>
      <CardHeader icon={<Cake size={18} />} title="Дни рождения" count={birthdays.length} />
      {birthdays.length > 0 ? (
        <div>
          {birthdays.map((person, i) => {
            const isToday = person.days_left === 0
            const isSoon  = person.days_left <= 3
            return (
              <div
                key={person.id}
                className="flex items-center gap-3 px-4 py-3 @md:px-6"
                style={{
                  borderBottom: i < birthdays.length - 1 ? '1px solid var(--color-border)' : undefined,
                  background: isToday ? 'color-mix(in oklab, var(--color-green) 12%, transparent)' : undefined,
                }}
              >
                {isToday ? (
                  <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold"
                       style={{ background: 'var(--color-green)', color: '#0a0f0a' }}>
                    {person.full_name.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <Avatar id={person.id} name={person.full_name} size={36} />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isToday ? 'text-green' : 'text-text'}`}>
                    {person.full_name}
                  </p>
                  <p className="text-xs truncate text-text-dim">
                    {person.position ?? roleLabel[person.role]}
                  </p>
                </div>
                <div className="shrink-0">
                  {isToday
                    ? <BadgeSolid>Сегодня 🎂</BadgeSolid>
                    : <Badge tone={isSoon ? 'warn' : 'neutral'}>
                        <span className="hidden @xs:inline">через </span>
                        <span className="num">{person.days_left}</span>
                        <span className="hidden @sm:inline"> {person.days_left === 1 ? 'день' : person.days_left < 5 ? 'дня' : 'дней'}</span>
                        <span className="@sm:hidden">д.</span>
                      </Badge>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <CardEmpty compact icon={<Cake size={20} />} text="В ближайшие 30 дней дней рождения нет" />
      )}
    </Card>
  )
}
