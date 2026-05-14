import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import TeamView, { type TeamReport, type TeamMember } from '@/components/daily/TeamView'
import { todayStringOral } from '@/lib/utils/date'
import { hasDirectorAccess } from '@/lib/roles'

export const revalidate = 0

export default async function DailyTeamPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')
  if (!hasDirectorAccess(profile.role)) redirect('/dashboard/daily')

  const today = todayStringOral()

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

  const todayLabel = new Date(today).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral',
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div>
      <PageHeader
        icon={<Users size={18} />}
        iconTone="info"
        title="Команда сегодня"
        subtitle={<span className="first-letter:uppercase">{todayLabel}</span>}
        back={{ href: '/dashboard/daily', label: 'К моему отчёту' }}
      />
      <TeamView
        teamReports={(teamReports ?? []) as unknown as TeamReport[]}
        teamMembers={(teamMembers ?? []) as unknown as TeamMember[]}
      />
    </div>
  )
}
