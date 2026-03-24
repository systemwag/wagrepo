import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import TrafficLightBoard, { DeadlineTask, TrafficCategory } from '@/components/ui/TrafficLightBoard'

export const revalidate = 0 // test page, always fetch fresh

export default async function DeadlinesTestPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  // 1. Извлекаем открытые задачи с дедлайнами и названием проекта (если есть)
  const { data: rawTasks, error: taskErr } = await supabase
    .from('tasks')
    .select(`
      id, title, deadline, status,
      assignee:profiles!tasks_assignee_id_fkey(full_name),
      project:projects(name)
    `)
    .neq('status', 'done')
    .not('deadline', 'is', null)

  if (taskErr) console.error("Ошибка загрузки задач:", taskErr)

  // 2. Извлекаем активные проекты с дедлайнами
  const { data: rawProjects, error: projErr } = await supabase
    .from('projects')
    .select(`
      id, name, deadline, status,
      manager:profiles!projects_manager_id_fkey(full_name)
    `)
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .not('deadline', 'is', null)

  if (projErr) console.error("Ошибка загрузки проектов:", projErr)

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayTime = now.getTime()

  const processedTasks: DeadlineTask[] = []

  // Обработка задач
  ;(rawTasks || []).forEach(t => {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    const assigneeName = assignee?.full_name || 'Не назначен'
    
    // Если задача привязана к проекту, добавим это в название для контекста
    const proj = Array.isArray(t.project) ? t.project[0] : t.project
    const displayTitle = proj ? `${proj.name}: ${t.title}` : t.title

    const deadlineDate = new Date(t.deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    
    const diffTime = deadlineDate.getTime() - todayTime
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    let category: TrafficCategory = 'green'
    if (diffDays < 0) category = 'red'
    else if (diffDays <= 1) category = 'orange'
    else if (diffDays <= 3) category = 'yellow'

    processedTasks.push({
      id: `task-${t.id}`,
      title: displayTitle,
      type: 'task',
      assigneeName,
      deadline: t.deadline,
      diffDays,
      category,
    })
  })

  // Обработка проектов
  ;(rawProjects || []).forEach(p => {
    const manager = Array.isArray(p.manager) ? p.manager[0] : p.manager
    const assigneeName = manager?.full_name || 'Без ПМ'

    const deadlineDate = new Date(p.deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    
    const diffTime = deadlineDate.getTime() - todayTime
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    let category: TrafficCategory = 'green'
    if (diffDays < 0) category = 'red'
    else if (diffDays <= 1) category = 'orange'
    else if (diffDays <= 3) category = 'yellow'

    processedTasks.push({
      id: `proj-${p.id}`,
      title: p.name,
      type: 'project',
      assigneeName,
      deadline: p.deadline,
      diffDays,
      category,
    })
  })

  // Сортировка внутри колонок по возрастанию оставшихся дней
  processedTasks.sort((a, b) => a.diffDays - b.diffDays)

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto py-10 px-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Светофор просрочек <span className="text-green-500 text-lg align-top ml-2">[ТЕСТ]</span>
        </h1>
        <p className="mt-2 text-[color:var(--text-muted)] leading-relaxed max-w-3xl">
          Единый дашборд контроля дедлайнов. Сюда автоматически попадают <strong>все незавершенные Проекты и Задачи</strong> из вашей базы данных, у которых установлен срок сдачи. С течением времени они перетекают слева направо.
        </p>
      </div>

      <div className="mt-8">
        <TrafficLightBoard tasks={processedTasks} />
      </div>

    </div>
  )
}
