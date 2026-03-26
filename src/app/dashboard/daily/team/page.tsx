import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TeamView, { type TeamReport, type TeamMember } from '@/components/daily/TeamView'

export const revalidate = 0

export default async function DailyTeamPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')
  if (profile.role !== 'director') redirect('/dashboard/daily')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: teamReports }, { data: teamMembers }] = await Promise.all([
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

  const todayLabel = new Date(today).toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/daily"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Назад
        </Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Команда сегодня</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{todayLabel}</p>
        </div>
      </div>

      <TeamView
        teamReports={(teamReports ?? []) as unknown as TeamReport[]}
        teamMembers={(teamMembers ?? []) as unknown as TeamMember[]}
      />
    </div>
  )
}
