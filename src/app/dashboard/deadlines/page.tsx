import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import TrafficLightBoard, { DeadlineTask, TrafficCategory } from '@/components/ui/TrafficLightBoard'
import { hasDirectorAccess } from '@/lib/roles'

export const revalidate = 60

export default async function DeadlinesPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!hasDirectorAccess(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  // Грузим максимум 200 ближайших дедлайнов — для светофора больше не имеет смысла,
  // если их столько, проблема не в UI, а в планировании.
  const [
    { data: rawDirectTasks },
    { data: rawProjectTasks },
    { data: rawProjects },
  ] = await Promise.all([
    supabase
      .from('direct_tasks')
      .select(`
        id, title, deadline, status,
        assignee:profiles!direct_tasks_assignee_id_fkey(full_name)
      `)
      .neq('status', 'done')
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
      .limit(100),

    supabase
      .from('project_tasks')
      .select(`
        id, title, deadline, status,
        assignee:profiles!project_tasks_assignee_id_fkey(full_name),
        project:projects(id, name)
      `)
      .neq('status', 'done')
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
      .limit(100),

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

  // Прямые поручения
  for (const t of rawDirectTasks ?? []) {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    const deadlineDate = new Date(t.deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((deadlineDate.getTime() - todayTime) / 86400000)

    items.push({
      id: `direct-${t.id}`,
      title: t.title,
      type: 'direct_task',
      assigneeName: assignee?.full_name ?? null,
      deadline: t.deadline,
      diffDays,
      category: calcCategory(diffDays),
      href: '/dashboard/assign',
    })
  }

  // Задачи в проектах
  for (const t of rawProjectTasks ?? []) {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    const proj = Array.isArray(t.project) ? t.project[0] : t.project
    const deadlineDate = new Date(t.deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((deadlineDate.getTime() - todayTime) / 86400000)

    items.push({
      id: `ptask-${t.id}`,
      title: proj ? `${proj.name}: ${t.title}` : t.title,
      type: 'project_task',
      assigneeName: assignee?.full_name ?? null,
      deadline: t.deadline,
      diffDays,
      category: calcCategory(diffDays),
      href: proj?.id ? `/dashboard/projects/${proj.id}` : '/dashboard/projects',
    })
  }

  // Проекты целиком
  for (const p of rawProjects ?? []) {
    const manager = Array.isArray(p.manager) ? p.manager[0] : p.manager
    const deadlineDate = new Date(p.deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((deadlineDate.getTime() - todayTime) / 86400000)

    items.push({
      id: `proj-${p.id}`,
      title: p.name,
      type: 'project',
      assigneeName: manager?.full_name ?? null,
      deadline: p.deadline,
      diffDays,
      category: calcCategory(diffDays),
      href: `/dashboard/projects/${p.id}`,
    })
  }

  items.sort((a, b) => a.diffDays - b.diffDays)

  return (
    <div>
      <PageHeader
        icon={<Clock size={18} />}
        iconTone="danger"
        title="Светофор дедлайнов"
        subtitle="Все незавершённые задачи и проекты с установленным сроком"
      />
      <TrafficLightBoard tasks={items} />
    </div>
  )
}
