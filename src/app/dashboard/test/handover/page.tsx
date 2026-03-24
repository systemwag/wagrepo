import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import HandoverBoard, { HandoverTask } from '@/components/ui/HandoverBoard'

export const revalidate = 0

export default async function HandoverTestPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  // Запрашиваем реальные задачи:
  // Мы сэмулируем "Передачу" на основе текущей базы данных.
  // 1. Входящие: где исполнитель ВЫ, а задача в статусе "todo" (новая, не начата).
  // 2. Исходящие: где создатель ВЫ, исполнитель КТО-ТО ДРУГОЙ, и статус "todo" (новая).
  
  const { data: rawTasks } = await supabase
    .from('tasks')
    .select(`
      id, title, status, created_at, assignee_id, created_by,
      creator:profiles!tasks_created_by_fkey(full_name),
      assignee:profiles!tasks_assignee_id_fkey(full_name),
      projects!left(name)
    `)
    .neq('status', 'done')
    .order('created_at', { ascending: false })

  const incomingTasks: HandoverTask[] = []
  const outgoingTasks: HandoverTask[] = []

  ;(rawTasks || []).forEach(t => {
    // Входящие (вы - исполнитель, задача еще не начата)
    if (t.assignee_id === profile.id && t.status === 'todo') {
      const creator = Array.isArray(t.creator) ? t.creator[0] : t.creator
      const proj = Array.isArray(t.projects) ? t.projects[0] : t.projects
      
      incomingTasks.push({
        id: t.id,
        title: t.title,
        fromUser: creator?.full_name || 'Неизвестный',
        toUser: 'Вам',
        stage: proj ? proj.name : 'Прямое поручение',
        dateSent: t.created_at,
        status: 'pending_my_acceptance'
      })
    }
    
    // Исходящие (вы - создатель, задача поручена другому и еще не начата им)
    if (t.created_by === profile.id && t.assignee_id && t.assignee_id !== profile.id && t.status === 'todo') {
      const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
      const proj = Array.isArray(t.projects) ? t.projects[0] : t.projects

      outgoingTasks.push({
        id: t.id,
        title: t.title,
        fromUser: 'Вы',
        toUser: assignee?.full_name || 'Сотруднику',
        stage: proj ? proj.name : 'Прямое поручение',
        dateSent: t.created_at,
        status: 'pending_their_acceptance'
      })
    }
  })

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-10 px-4">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            Перекличка (Рукопожатие) <span className="text-green-500 text-lg align-top ml-2">[ТЕСТ]</span>
          </h1>
          <p className="mt-3 text-[color:var(--text-muted)] leading-relaxed max-w-3xl">
            Только реальные данные. Сюда попадают задачи из вашей базы данных, которые находятся в статусе "Новая (todo)". Входящие — порученные вам; Исходящие — созданные вами для других.
          </p>
        </div>
        
        <div className="bg-amber-500/10 text-amber-500 p-4 rounded-xl border border-amber-500/20 max-w-[280px]">
          <p className="text-xs opacity-90 leading-relaxed">
            Как только статус задачи изменится с `todo` на `in_progress` (в работе) — она автоматически исчезнет с этой доски «передачи», так как считается принятой.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <HandoverBoard incomingTasks={incomingTasks} outgoingTasks={outgoingTasks} />
      </div>
    </div>
  )
}
