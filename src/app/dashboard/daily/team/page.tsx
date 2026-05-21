import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import TeamView, { type TeamReport, type TeamMember } from '@/components/daily/TeamView'
import { todayStringOral } from '@/lib/utils/date'
import { hasDirectorAccess, hasManagerAccess } from '@/lib/roles'

export const revalidate = 0

export default async function DailyTeamPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')
  // Доступ: director + admin (hasDirectorAccess покрывает admin).
  // Manager в принципе видит чужие отчёты по RLS, но управленческие
  // выводы из «команды сегодня» — это директорская задача.
  if (!hasDirectorAccess(profile.role)) redirect('/dashboard/daily')

  const today = todayStringOral()

  const [{ data: teamReports }, { data: teamMembers }] = await Promise.all([
    supabase
      .from('daily_reports')
      .select(`
        *,
        report_tasks:daily_report_tasks(*),
        reactions:daily_report_reactions(emoji, profile_id),
        author:profiles!daily_reports_author_id_fkey(id, full_name, position, role, department)
      `)
      .eq('report_date', today)
      .order('created_at', { ascending: false }),

    // Включаем все роли, которые ДОЛЖНЫ сдавать дейли (employee + manager).
    // Director/admin не обязаны — они не появляются в списке «не сдал».
    supabase
      .from('profiles')
      .select('id, full_name, position, role, department')
      .in('role', ['employee', 'manager'])
      .eq('is_active', true)
      .order('full_name'),
  ])

  const todayLabel = new Date(today + 'T00:00:00').toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral',
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
        viewerId={profile.id}
        canReact={hasManagerAccess(profile.role)}
        teamReports={(teamReports ?? []) as unknown as TeamReport[]}
        teamMembers={(teamMembers ?? []) as unknown as TeamMember[]}
      />
    </div>
  )
}
