import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import DeadlinesBoardClient from './DeadlinesBoardClient'
import type { DeadlineItem, DeadlineCategory, DeadlineEntityType } from '@/components/ui/TrafficLightBoard'
import { hasDirectorAccess } from '@/lib/roles'
import { todayStringOral } from '@/lib/utils/date'

export const revalidate = 60

type RpcRow = {
  source: DeadlineEntityType
  source_id: string
  title: string
  project_id: string | null
  project_name: string | null
  stage_id: string | null
  deadline: string | null
  status: string
  assignees: { id: string; full_name: string }[] | null
}

function calcCategory(diffDays: number | null): DeadlineCategory {
  if (diffDays === null)        return 'none'
  if (diffDays < 0)             return 'red'
  if (diffDays <= 1)            return 'orange'
  if (diffDays <= 3)            return 'yellow'
  return 'green'
}

/**
 * TZ-safe diff в днях между двумя YYYY-MM-DD-строками.
 * Считаем через UTC-полночь — результат стабилен в любой TZ окружения.
 */
function diffDaysFromToday(deadlineStr: string, todayStr: string): number {
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const [dy, dm, dd] = deadlineStr.split('-').map(Number)
  const todayUtc    = Date.UTC(ty, tm - 1, td)
  const deadlineUtc = Date.UTC(dy, dm - 1, dd)
  return Math.round((deadlineUtc - todayUtc) / 86400000)
}

function buildHref(row: RpcRow): string {
  switch (row.source) {
    case 'direct_task':
      return `/dashboard/assign?focus=${row.source_id}`
    case 'project_task':
    case 'checklist':
      return row.project_id
        ? `/dashboard/projects/${row.project_id}?focus=${row.source_id}`
        : '/dashboard/projects'
    case 'project':
      return `/dashboard/projects/${row.source_id}`
  }
}

export default async function DeadlinesPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!hasDirectorAccess(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  const { data: rpcData } = await supabase.rpc('get_deadlines_board')
  const rows = (rpcData ?? []) as RpcRow[]

  const today = todayStringOral()

  const items: DeadlineItem[] = rows.map(row => {
    const diffDays = row.deadline ? diffDaysFromToday(row.deadline, today) : null
    return {
      id:           `${row.source}-${row.source_id}`,
      sourceId:     row.source_id,
      type:         row.source,
      title:        row.title,
      projectId:    row.project_id,
      projectName:  row.project_name,
      stageId:      row.stage_id,
      assignees:    row.assignees ?? [],
      deadline:     row.deadline,
      diffDays,
      category:     calcCategory(diffDays),
      href:         buildHref(row),
      status:       row.status,
    }
  })

  // Сортировка: «без срока» в конец, остальное — по близости дедлайна.
  items.sort((a, b) => {
    if (a.diffDays === null && b.diffDays === null) return 0
    if (a.diffDays === null) return 1
    if (b.diffDays === null) return -1
    return a.diffDays - b.diffDays
  })

  return (
    <div>
      <PageHeader
        icon={<Clock size={18} />}
        iconTone="warn"
        title="Светофор дедлайнов"
        subtitle="Все незавершённые задачи, поручения, чек-листы и проекты"
      />
      <DeadlinesBoardClient items={items} />
    </div>
  )
}
