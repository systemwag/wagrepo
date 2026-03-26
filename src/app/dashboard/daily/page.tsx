import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import DailyReportClient from '@/components/daily/DailyReportClient'

export const revalidate = 0

export default async function DailyReportPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
  const historyFrom = fourteenDaysAgo.toISOString().split('T')[0]

  const [
    { data: todayReport },
    { data: activeTasks },
    { data: activeStages },
    { data: history },
  ] = await Promise.all([
    supabase
      .from('daily_reports')
      .select('*, report_tasks:daily_report_tasks(*)')
      .eq('author_id', profile.id)
      .eq('report_date', today)
      .maybeSingle(),

    supabase
      .from('tasks')
      .select('id, title, status, project:projects(name)')
      .eq('assignee_id', profile.id)
      .not('status', 'eq', 'done')
      .order('deadline', { ascending: true, nullsFirst: false }),

    supabase
      .from('project_stages')
      .select('id, name, status, project:projects!project_stages_project_id_fkey(id, name), deadline')
      .eq('assignee_id', profile.id)
      .not('status', 'eq', 'completed')
      .order('deadline', { ascending: true, nullsFirst: false }),

    supabase
      .from('daily_reports')
      .select('*, report_tasks:daily_report_tasks(*)')
      .eq('author_id', profile.id)
      .gte('report_date', historyFrom)
      .order('report_date', { ascending: false }),
  ])

  // Для менеджера/директора: отчёты команды сегодня + список всех сотрудников
  type TeamMember = { id: string; full_name: string; position: string | null; role: string }
  type TeamReportRow = { id: string; report_date: string; did_today: string; plan_tomorrow: string | null; has_blocker: boolean; blocker_text: string | null; workload: number | null; created_at: string; author_id: string; report_tasks: { id: string; task_id: string | null; stage_id: string | null; task_title: string; hours_spent: number; is_completed: boolean }[]; author: TeamMember | null }
  let teamReports: TeamReportRow[] = []
  let teamMembers: TeamMember[] = []

  if (profile.role === 'director' || profile.role === 'manager') {
    const [{ data: tr }, { data: tm }] = await Promise.all([
      supabase
        .from('daily_reports')
        .select(`
          *,
          report_tasks:daily_report_tasks(*),
          author:profiles!daily_reports_author_id_fkey(id, full_name, position, role)
        `)
        .eq('report_date', today)
        .order('created_at', { ascending: false }),

      supabase
        .from('profiles')
        .select('id, full_name, position, role')
        .in('role', ['employee', 'manager'])
        .order('full_name'),
    ])
    teamReports = tr ?? []
    teamMembers = tm ?? []
  }

  return (
    <DailyReportClient
      profile={profile}
      today={today}
      todayReport={todayReport ?? null}
      activeTasks={(activeTasks ?? []) as unknown as { id: string; title: string; status: string; project: { name: string } | null }[]}
      activeStages={(activeStages ?? []) as unknown as { id: string; name: string; status: string; project: { id: string; name: string } | null; deadline: string | null }[]}
      history={(history ?? []) as { id: string; report_date: string; did_today: string; plan_tomorrow: string | null; has_blocker: boolean; blocker_text: string | null; workload: number | null; created_at: string; report_tasks: { id: string; task_id: string | null; stage_id: string | null; task_title: string; hours_spent: number; is_completed: boolean }[] }[]}
      historyFrom={historyFrom}
      teamReports={teamReports}
      teamMembers={teamMembers}
    />
  )
}
