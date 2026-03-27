import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import DailyReportClient from '@/components/daily/DailyReportClient'
import { todayStringOral } from '@/lib/utils/date'

export const revalidate = 0

export default async function DailyReportPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')

  const today = todayStringOral()

  const fourteenDaysAgo = new Date(today)
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

  return (
    <DailyReportClient
      profile={profile}
      today={today}
      todayReport={todayReport ?? null}
      activeTasks={(activeTasks ?? []) as unknown as { id: string; title: string; status: string; project: { name: string } | null }[]}
      activeStages={(activeStages ?? []) as unknown as { id: string; name: string; status: string; project: { id: string; name: string } | null; deadline: string | null }[]}
      history={(history ?? []) as { id: string; report_date: string; did_today: string; plan_tomorrow: string | null; has_blocker: boolean; blocker_text: string | null; workload: number | null; created_at: string; report_tasks: { id: string; task_id: string | null; stage_id: string | null; task_title: string; hours_spent: number; is_completed: boolean }[] }[]}
    />
  )
}
