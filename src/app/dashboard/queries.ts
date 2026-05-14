import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { todayStringOral } from '@/lib/utils/date'

export type Birthday = {
  id: string
  full_name: string
  role: string
  position: string | null
  birth_date: string
  days_left: number
}

export type SilentEmployee = {
  id: string
  full_name: string
  role: string
  position: string | null
}

export type DashboardEvent = {
  id: string
  title: string
  date: string
  start_time: string | null
  importance: string
  location: string | null
}

/** Ближайшие 14 дней событий, до 6 шт. */
export async function getUpcomingEvents(): Promise<DashboardEvent[]> {
  const supabase = await createClient()
  const todayStr = todayStringOral()
  const plus14   = new Date(todayStr); plus14.setDate(plus14.getDate() + 14)
  const plus14Str = plus14.toISOString().split('T')[0]

  const { data } = await supabase
    .from('events')
    .select('id, title, date, start_time, importance, location')
    .gte('date', todayStr)
    .lte('date', plus14Str)
    .order('date').order('start_time', { nullsFirst: true })
    .limit(6)

  return (data ?? []) as DashboardEvent[]
}

/** Дни рождения в ближайшие 30 дней — считается на стороне Postgres. */
export async function getUpcomingBirthdays(days = 30): Promise<Birthday[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_upcoming_birthdays', { p_days: days })
  return (data ?? []) as Birthday[]
}

/** Счётчики проектных задач сотрудника по статусу. */
export async function getMyProjectTaskCounts(userId: string): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_my_project_task_counts', { p_user_id: userId })
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { status: string; count: number }[]) {
    counts[row.status] = row.count
  }
  return counts
}

/** Счётчики прямых поручений сотрудника по статусу. */
export async function getMyDirectTaskCounts(userId: string): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_my_direct_task_counts', { p_user_id: userId })
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { status: string; count: number }[]) {
    counts[row.status] = row.count
  }
  return counts
}

/** Счётчики всех прямых поручений (директорский дашборд). */
export async function getAllDirectTaskCounts(): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_all_direct_task_counts')
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { status: string; count: number }[]) {
    counts[row.status] = row.count
  }
  return counts
}

/** Просроченные задачи и поручения сотрудника. */
export async function getMyOverdueCounts(userId: string): Promise<{ direct: number; project: number }> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_my_overdue_counts', { p_user_id: userId })
  const result = { direct: 0, project: 0 }
  for (const row of (data ?? []) as { kind: 'direct' | 'project'; count: number }[]) {
    result[row.kind] = row.count
  }
  return result
}

/** Сотрудники без дейли-отчёта за сегодня. Только для директора. */
export async function getSilentEmployees(): Promise<SilentEmployee[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_silent_employees_today')
  return (data ?? []) as SilentEmployee[]
}

/** Подавал ли я дейли-отчёт сегодня — для CTA «Подать дейли». */
export async function hasMyDailyToday(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const today = todayStringOral()
  const { data } = await supabase
    .from('daily_reports')
    .select('id')
    .eq('author_id', userId)
    .eq('report_date', today)
    .maybeSingle()
  return !!data
}
