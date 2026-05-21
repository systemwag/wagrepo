import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import DailyReportClient from '@/components/daily/DailyReportClient'
import { todayStringOral } from '@/lib/utils/date'

export const revalidate = 0

// Помощник: вернуть YYYY-MM-DD на N дней раньше указанной даты.
function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().split('T')[0]
}

export default async function DailyReportPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')

  const today        = todayStringOral()
  const yesterday    = shiftDate(today, -1)
  const historyFrom  = shiftDate(today, -13)

  // Активные сущности — через junction-таблицы (миграция 039), чтобы
  // соисполнители тоже видели свои задачи. legacy assignee_id отдаёт
  // только первого ответственного.
  const [
    { data: todayReport },
    { data: yesterdayReport },
    { data: activeDirectTasks },
    { data: activeProjectTasks },
    { data: activeStages },
    { data: history },
    streakResult,
  ] = await Promise.all([
    supabase
      .from('daily_reports')
      .select(`
        *,
        report_tasks:daily_report_tasks(*),
        reactions:daily_report_reactions(emoji, profile_id)
      `)
      .eq('author_id', profile.id)
      .eq('report_date', today)
      .maybeSingle(),

    supabase
      .from('daily_reports')
      .select('id, plan_tomorrow, report_date')
      .eq('author_id', profile.id)
      .eq('report_date', yesterday)
      .maybeSingle(),

    supabase
      .from('direct_tasks')
      .select('id, title, status, direct_task_assignees!inner(profile_id)')
      .eq('direct_task_assignees.profile_id', profile.id)
      .not('status', 'eq', 'done')
      .order('deadline', { ascending: true, nullsFirst: false }),

    supabase
      .from('project_tasks')
      .select(`
        id, title, status,
        project:projects!project_tasks_project_id_fkey(name),
        project_task_assignees!inner(profile_id)
      `)
      .eq('project_task_assignees.profile_id', profile.id)
      .not('status', 'eq', 'done')
      .order('deadline', { ascending: true, nullsFirst: false }),

    supabase
      .from('project_stages')
      .select(`
        id, name, status, deadline,
        project:projects!project_stages_project_id_fkey(id, name),
        project_stage_assignees!inner(profile_id)
      `)
      .eq('project_stage_assignees.profile_id', profile.id)
      .not('status', 'eq', 'completed')
      .order('deadline', { ascending: true, nullsFirst: false }),

    supabase
      .from('daily_reports')
      .select(`
        *,
        report_tasks:daily_report_tasks(*),
        reactions:daily_report_reactions(emoji, profile_id)
      `)
      .eq('author_id', profile.id)
      .gte('report_date', historyFrom)
      .order('report_date', { ascending: false }),

    // RPC считает streak на сервере: не зависит от ширины окна history.
    supabase.rpc('get_my_daily_streak', { p_user_id: profile.id }),
  ])

  const streak = typeof streakResult.data === 'number' ? streakResult.data : 0

  type DirectRow  = { id: string; title: string; status: string }
  type ProjectRow = {
    id: string; title: string; status: string
    project: { name: string } | { name: string }[] | null
  }
  type StageRow = {
    id: string; name: string; status: string; deadline: string | null
    project: { id: string; name: string } | { id: string; name: string }[] | null
  }

  // Supabase возвращает FK-ссылку как объект или массив (зависит от количества).
  // Нормализуем в одиночный объект для UI.
  const normProj = <T extends { name: string }>(p: T | T[] | null): T | null =>
    Array.isArray(p) ? (p[0] ?? null) : p

  return (
    <DailyReportClient
      profile={profile}
      today={today}
      todayReport={todayReport ?? null}
      yesterdayPlan={yesterdayReport?.plan_tomorrow ?? null}
      streak={streak}
      activeDirectTasks={(activeDirectTasks ?? []).map((t: DirectRow) => ({
        id: t.id, title: t.title, status: t.status,
      }))}
      activeProjectTasks={((activeProjectTasks ?? []) as unknown as ProjectRow[]).map(t => ({
        id: t.id, title: t.title, status: t.status,
        project: normProj(t.project),
      }))}
      activeStages={((activeStages ?? []) as unknown as StageRow[]).map(s => ({
        id: s.id, name: s.name, status: s.status, deadline: s.deadline,
        project: normProj(s.project),
      }))}
      history={(history ?? []) as unknown as {
        id: string; report_date: string; did_today: string; plan_tomorrow: string | null
        has_blocker: boolean; blocker_text: string | null; workload: number | null
        created_at: string
        report_tasks: {
          id: string; direct_task_id: string | null; project_task_id: string | null
          stage_id: string | null; task_title: string; hours_spent: number; is_completed: boolean
        }[]
        reactions: { emoji: string; profile_id: string }[]
      }[]}
    />
  )
}
