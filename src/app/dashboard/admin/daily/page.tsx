import { FileText, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { TransitionLink } from '@/components/ui/TransitionLink'
import AdminDailyDaysTable, { type DailyDayRow } from './AdminDailyDaysTable'

export const dynamic = 'force-dynamic'

export default async function AdminDailyPage() {
  const supabase = await createClient()

  // Тянем только id + report_date для группировки. Полные тексты отчётов
  // в админке для удаления по дням не нужны. На паре тысяч строк ~80KB —
  // в пределах нормы; если когда-нибудь вырастет — переписать на RPC с GROUP BY.
  const { data } = await supabase
    .from('daily_reports')
    .select('id, report_date')
    .order('report_date', { ascending: false })

  const byDate = new Map<string, number>()
  for (const r of (data ?? []) as { id: string; report_date: string }[]) {
    byDate.set(r.report_date, (byDate.get(r.report_date) ?? 0) + 1)
  }

  const rows: DailyDayRow[] = [...byDate.entries()].map(([date, count]) => ({
    date,
    count,
  }))

  const totalReports = data?.length ?? 0

  return (
    <div>
      <PageHeader
        icon={<FileText size={18} />}
        iconTone="info"
        title="Дейли-отчёты"
        subtitle={`Удаление по дням. Всего ${totalReports} отчётов в ${rows.length} ${pluralDays(rows.length)}.`}
        back={{ href: '/dashboard/admin', label: 'В админ-панель' }}
        action={
          <TransitionLink
            href="/dashboard/admin"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text-muted hover-text hover-surface transition-colors"
          >
            <ArrowLeft size={16} />
            <span>В админ</span>
          </TransitionLink>
        }
      />
      <AdminDailyDaysTable rows={rows} />
    </div>
  )
}

function pluralDays(n: number): string {
  const last = n % 10
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'днях'
  if (last === 1) return 'дне'
  if (last >= 2 && last <= 4) return 'днях'
  return 'днях'
}
