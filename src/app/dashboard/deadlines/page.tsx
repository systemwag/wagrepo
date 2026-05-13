import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import TrafficLightBoard, { DeadlineTask, TrafficCategory } from '@/components/ui/TrafficLightBoard'

export const revalidate = 60

export default async function DeadlinesPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'director') redirect('/dashboard')

  const supabase = await createClient()

  // Грузим максимум 200 ближайших дедлайнов — для светофора больше не имеет смысла,
  // если их столько, проблема не в UI, а в планировании.
  const [{ data: rawTasks }, { data: rawProjects }] = await Promise.all([
    supabase
      .from('tasks')
      .select(`
        id, title, deadline, status,
        assignee:profiles!tasks_assignee_id_fkey(full_name),
        project:projects(name)
      `)
      .neq('status', 'done')
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
      .limit(150),

    supabase
      .from('projects')
      .select(`
        id, name, deadline, status,
        manager:profiles!projects_manager_id_fkey(full_name)
      `)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
      .limit(50),
  ])

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayTime = now.getTime()

  function calcCategory(diffDays: number): TrafficCategory {
    if (diffDays < 0)      return 'red'
    if (diffDays <= 1)     return 'orange'
    if (diffDays <= 3)     return 'yellow'
    return 'green'
  }

  const items: DeadlineTask[] = []

  for (const t of rawTasks ?? []) {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    const proj = Array.isArray(t.project) ? t.project[0] : t.project
    const deadlineDate = new Date(t.deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((deadlineDate.getTime() - todayTime) / 86400000)

    items.push({
      id: `task-${t.id}`,
      title: proj ? `${proj.name}: ${t.title}` : t.title,
      type: 'task',
      assigneeName: assignee?.full_name ?? 'Не назначен',
      deadline: t.deadline,
      diffDays,
      category: calcCategory(diffDays),
    })
  }

  for (const p of rawProjects ?? []) {
    const manager = Array.isArray(p.manager) ? p.manager[0] : p.manager
    const deadlineDate = new Date(p.deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((deadlineDate.getTime() - todayTime) / 86400000)

    items.push({
      id: `proj-${p.id}`,
      title: p.name,
      type: 'project',
      assigneeName: manager?.full_name ?? 'Без ПМ',
      deadline: p.deadline,
      diffDays,
      category: calcCategory(diffDays),
    })
  }

  items.sort((a, b) => a.diffDays - b.diffDays)

  const redCount    = items.filter(i => i.category === 'red').length
  const orangeCount = items.filter(i => i.category === 'orange').length

  return (
    <div>
      <PageHeader
        icon={<Clock size={18} />}
        iconTone="danger"
        title="Светофор дедлайнов"
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <span>Все незавершённые задачи и проекты с установленным сроком</span>
            {redCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: 'color-mix(in oklab, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)' }}>
                {redCount} просрочено
              </span>
            )}
            {orangeCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: 'color-mix(in oklab, var(--color-warn) 12%, transparent)', color: 'var(--color-warn)', border: '1px solid color-mix(in oklab, var(--color-warn) 25%, transparent)' }}>
                {orangeCount} горит
              </span>
            )}
          </span>
        }
      />
      <TrafficLightBoard tasks={items} />
    </div>
  )
}
