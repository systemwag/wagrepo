import { createClient, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Cake, Newspaper, CalendarDays } from 'lucide-react'

function birthdayDaysLeft(birthDate: string): number {
  const today = new Date()
  const bd    = new Date(birthDate)
  const next  = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

function calcAge(birthDate: string): number {
  const today = new Date()
  const bd    = new Date(birthDate)
  let age = today.getFullYear() - bd.getFullYear()
  if (today.getMonth() < bd.getMonth() ||
    (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) age--
  return age + 1 // исполнится
}

const roleLabel: Record<string, string> = {
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}

export default async function DashboardPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')
  if (profile.role === 'employee') redirect('/dashboard/tasks')

  // Дни рождения в ближайшие 30 дней
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, position, birth_date')
    .not('birth_date', 'is', null)
    .eq('is_active', true)

  const upcomingBirthdays = (allProfiles ?? [])
    .map(p => ({ ...p, daysLeft: birthdayDaysLeft(p.birth_date!) }))
    .filter(p => p.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // Ближайшие мероприятия (следующие 14 дней)
  const todayDate = new Date()
  const todayStr  = todayDate.toISOString().split('T')[0]
  const plusTwo   = new Date(todayDate)
  plusTwo.setDate(plusTwo.getDate() + 14)
  const plusTwoStr = plusTwo.toISOString().split('T')[0]

  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('id, title, date, start_time, importance, location')
    .gte('date', todayStr)
    .lte('date', plusTwoStr)
    .order('date')
    .order('start_time', { nullsFirst: true })
    .limit(6)

  const hour = new Date().getHours()
  const greeting =
    hour >= 5  && hour < 12 ? 'Доброе утро' :
    hour >= 12 && hour < 18 ? 'Добрый день' :
    hour >= 18 && hour < 23 ? 'Добрый вечер' :
    'Доброй ночи'
  const firstName = profile.full_name.split(' ')[0]

  return (
    <div>
      {/* Логотип + профиль */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="WAG" style={{ height: 'clamp(60px, 18vw, 180px)', width: 'auto' }} />
          <p className="text-xs md:text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="text-right text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          <p style={{ color: 'var(--text)' }} className="font-medium">{profile.full_name.split(' ')[0]}</p>
          <p>{roleLabel[profile.role]}</p>
        </div>
      </div>

      {/* Приветствие */}
      <div className="mb-6">
        <h1 className="font-bold" style={{ color: 'var(--text)', fontSize: 'clamp(1.5rem, 6vw, 2.4rem)', lineHeight: 1.15 }}>
          {greeting}, <span style={{ color: 'var(--green)' }}>{firstName}</span>!
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
        {/* Новости */}
        <div className="card col-span-full">
          <div
            className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <Newspaper size={18} style={{ color: 'var(--green)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Новости компании</h2>
          </div>
          <div className="px-4 py-8 flex flex-col items-center gap-3" style={{ color: 'var(--text-muted)' }}>
            <Newspaper size={40} style={{ opacity: 0.2 }} />
            <p className="text-sm">Новостей пока нет</p>
          </div>
        </div>

        {/* Мероприятия */}
        <div className="card md:col-span-1">
          <div
            className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <CalendarDays size={18} style={{ color: 'var(--green)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Ближайшие мероприятия</h2>
            {(upcomingEvents ?? []).length > 0 && (
              <span
                className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                {upcomingEvents!.length}
              </span>
            )}
          </div>

          {(upcomingEvents ?? []).length > 0 ? (
            <div>
              {upcomingEvents!.map((ev, i) => {
                const importanceColor: Record<string, string> = {
                  low:      '#60a5fa',
                  medium:   '#fbbf24',
                  high:     '#fb923c',
                  critical: '#f87171',
                }
                const evDate     = new Date(ev.date + 'T00:00:00')
                const isEvToday  = ev.date === todayStr
                const daysDiff   = Math.round((evDate.getTime() - todayDate.setHours(0,0,0,0)) / 86400000)
                const color      = importanceColor[ev.importance] ?? '#fbbf24'

                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 px-4 py-3 md:px-6"
                    style={{ borderBottom: i < upcomingEvents!.length - 1 ? '1px solid var(--border)' : undefined }}
                  >
                    {/* Color dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: color }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                        {ev.title}
                      </p>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-dim)' }}>
                        {evDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        {ev.start_time && ` · ${ev.start_time.slice(0, 5)}`}
                        {ev.location   && ` · ${ev.location}`}
                      </p>
                    </div>

                    {/* Badge */}
                    <div className="flex-shrink-0">
                      {isEvToday ? (
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
                        >
                          Сегодня
                        </span>
                      ) : (
                        <span
                          className="text-xs px-2.5 py-1 rounded-lg"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                        >
                          через {daysDiff} {daysDiff === 1 ? 'день' : daysDiff < 5 ? 'дня' : 'дней'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-8 flex flex-col items-center gap-3" style={{ color: 'var(--text-muted)' }}>
              <CalendarDays size={40} style={{ opacity: 0.2 }} />
              <p className="text-sm">Мероприятий в ближайшие 14 дней нет</p>
            </div>
          )}
        </div>

        {/* Дни рождения */}
        <div className="card md:col-span-1">
          <div
            className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <Cake size={18} style={{ color: 'var(--green)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Ближайшие дни рождения</h2>
            {upcomingBirthdays.length > 0 && (
              <span
                className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                {upcomingBirthdays.length}
              </span>
            )}
          </div>

          {upcomingBirthdays.length > 0 ? (
            <div>
              {upcomingBirthdays.map((person, i) => {
                const isToday = person.daysLeft === 0
                const isSoon  = person.daysLeft <= 3
                return (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 px-4 py-3 md:px-6"
                    style={{
                      borderBottom: i < upcomingBirthdays.length - 1 ? '1px solid var(--border)' : undefined,
                      background: isToday ? 'var(--green-glow)' : undefined,
                    }}
                  >
                    {/* Аватар */}
                    <div
                      className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold"
                      style={isToday
                        ? { background: 'var(--green)', color: '#0a0f0a' }
                        : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
                      }
                    >
                      {person.full_name.charAt(0).toUpperCase()}
                    </div>

                    {/* Имя + должность */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: isToday ? 'var(--green)' : 'var(--text)' }}>
                        {person.full_name}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
                        {person.position ?? roleLabel[person.role]}
                      </p>
                    </div>

                    {/* Бейдж */}
                    <div className="flex-shrink-0 text-right">
                      {isToday ? (
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{ background: 'var(--green)', color: '#0a0f0a' }}
                        >
                          Сегодня 🎂
                        </span>
                      ) : (
                        <span
                          className="text-xs font-medium px-2.5 py-1 rounded-lg"
                          style={isSoon
                            ? { background: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.2)' }
                            : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
                          }
                        >
                          через {person.daysLeft} {person.daysLeft === 1 ? 'день' : person.daysLeft < 5 ? 'дня' : 'дней'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-8 flex flex-col items-center gap-3" style={{ color: 'var(--text-muted)' }}>
              <Cake size={40} style={{ opacity: 0.2 }} />
              <p className="text-sm">В ближайшие 30 дней дней рождения нет</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
