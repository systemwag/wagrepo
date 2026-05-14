import { redirect } from 'next/navigation'
import { Gauge } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { hasDirectorAccess } from '@/lib/roles'
import WorkloadTable, { type WorkloadRow } from './WorkloadTable'

export const revalidate = 30

export default async function WorkloadPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!hasDirectorAccess(profile.role)) redirect('/dashboard')

  const supabase = await createClient()
  const { data } = await supabase.rpc('get_workload_overview')
  const rows = ((data ?? []) as WorkloadRow[])

  // Сводные счётчики для подзаголовка
  const over    = rows.filter(r => r.in_progress_count > r.wip_limit).length
  const overdue = rows.reduce((sum, r) => sum + r.overdue_count, 0)
  const idle    = rows.filter(r => r.in_progress_count === 0 && r.todo_count === 0).length

  return (
    <div>
      <PageHeader
        icon={<Gauge size={18} />}
        iconTone="info"
        title="Загрузка команды"
        subtitle={
          <span className="flex items-center gap-3 flex-wrap text-xs">
            <span>{rows.length} активных сотрудников</span>
            {over > 0 && (
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{
                  background: 'color-mix(in oklab, var(--color-danger) 12%, transparent)',
                  color: 'var(--color-danger)',
                  border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)',
                }}
              >
                {over} перегружены
              </span>
            )}
            {overdue > 0 && (
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{
                  background: 'color-mix(in oklab, var(--color-warn) 12%, transparent)',
                  color: 'var(--color-warn)',
                  border: '1px solid color-mix(in oklab, var(--color-warn) 25%, transparent)',
                }}
              >
                {overdue} просрочек
              </span>
            )}
            {idle > 0 && (
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {idle} без задач
              </span>
            )}
          </span>
        }
      />
      <WorkloadTable rows={rows} />
    </div>
  )
}
