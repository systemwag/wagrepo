import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import TrafficLightBoard, { DeadlineTask, TrafficCategory } from '@/components/ui/TrafficLightBoard'

export const revalidate = 60

export default async function DeadlinesPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'director') redirect('/dashboard')

  const supabase = await createClient()

  const [{ data: rawTasks }, { data: rawProjects }] = await Promise.all([
    supabase
      .from('tasks')
      .select(`
        id, title, deadline, status,
        assignee:profiles!tasks_assignee_id_fkey(full_name),
        project:projects(name)
      `)
      .neq('status', 'done')
      .not('deadline', 'is', null),

    supabase
      .from('projects')
      .select(`
        id, name, deadline, status,
        manager:profiles!projects_manager_id_fkey(full_name)
      `)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .not('deadline', 'is', null),
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Светофор дедлайнов</h1>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Все незавершённые задачи и проекты с установленным сроком
          </p>
          {redCount > 0 && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
              {redCount} просрочено
            </span>
          )}
          {orangeCount > 0 && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' }}>
              {orangeCount} горит
            </span>
          )}
        </div>
      </div>

      <TrafficLightBoard tasks={items} />
    </div>
  )
}
