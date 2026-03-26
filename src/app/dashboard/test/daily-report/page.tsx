import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import DailyReportForm from '@/components/ui/DailyReportForm'
import { Clock } from 'lucide-react'

export const revalidate = 0

export default async function DailyReportTestPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  // 1. Получаем список АКТИВНЫХ задач для текущего пользователя.
  // Для тестирования добавим еще задачи, которые ВЫ создали, чтобы точно было на чем проверить.
  const { data: rawMyTasks, error: taskErr } = await supabase
    .from('tasks')
    .select(`
      id, title,
      project:projects(name)
    `)
    .or(`assignee_id.eq.${profile.id},created_by.eq.${profile.id}`)
    .neq('status', 'done')

  if (taskErr) console.error("Ошибка загрузки задач для отчета:", taskErr)

  const myTasks = (rawMyTasks || []).map(t => {
    const proj = Array.isArray(t.project) ? t.project[0] : t.project
    return {
      id: t.id,
      title: t.title,
      project_name: proj?.name
    }
  })

  // 2. Получаем сегодняшние отчеты всей компании (для демонстрации Руководителю)
  // В базе есть таблица task_reports (id, task_id, author_id, content, hours_spent, created_at)
  
  // Устанавливаем начало сегодняшнего дня в ISO для фильтра
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  
  const { data: todaysReports } = await supabase
    .from('task_reports')
    .select(`
      id, content, hours_spent, created_at,
      author:profiles!task_reports_author_id_fkey(full_name, role),
      task:tasks(title, project:projects(name))
    `)
    .gte('created_at', startOfToday.toISOString())
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-10 px-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Дейли-отчет (Daily Check-in) <span className="text-green-500 text-lg align-top ml-2">[ТЕСТ]</span>
        </h1>
        <p className="mt-3 text-[color:var(--text-muted)] leading-relaxed max-w-3xl">
          Этот инструмент позволяет быстро собрать результаты работы команды в конце дня. Работает напрямую с реальной таблицей <code>task_reports</code> из вашей базы данных Supabase.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* ЛЕВАЯ КОЛОНКА: Форма сдачи отчета */}
        <div className="w-full lg:w-[400px] flex-shrink-0">
          <DailyReportForm myTasks={myTasks} userId={profile.id} />
          
          <div className="mt-6 bg-[#3b82f6]/10 text-[#3b82f6] p-5 rounded-2xl border border-[#3b82f6]/20">
            <h3 className="font-bold text-sm mb-2">Как заставить всех заполнять?</h3>
            <p className="text-xs opacity-80 leading-relaxed mb-3">
              Можно внедрить правило «Светофора»: если сотрудник в 18:30 не заполнил Дейли-отчет, система автоматически присылает ему Push-уведомление в Telegram. А если он забыл 3 раза за неделю — уведомление улетает Директору для начисления штрафа.
            </p>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА: Сводка отчетов для руководителя */}
        <div className="flex-1 w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 border-b border-[color:var(--border)] pb-4">
            <h2 className="text-xl font-semibold text-[color:var(--text)]">Картина дня (Сводка руководителя)</h2>
            <div className="text-xs font-bold bg-[#3b82f6] text-white px-3 py-1 rounded-full shadow-sm">
              {todaysReports?.length || 0} отчетов сегодня
            </div>
          </div>

          {!todaysReports || todaysReports.length === 0 ? (
            <div className="text-center py-12 text-[color:var(--text-muted)] border border-dashed rounded-xl">
              Сотрудники пока не прислали ни одного отчета за сегодня.
              <br />Попробуйте отправить отчет через форму слева!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaysReports.map(report => {
                const author = Array.isArray(report.author) ? report.author[0] : report.author
                const task = Array.isArray(report.task) ? report.task[0] : (report.task as { title: string; project: { name: string } | null } | null)
                const proj = task?.project ? (Array.isArray(task.project) ? task.project[0] : task.project) : null
                
                const taskTitle = task?.title || 'Удаленная задача'
                const projName = proj?.name ? `[${proj.name}] ` : ''

                return (
                  <div key={report.id} className="p-4 rounded-xl border bg-[color:var(--surface)] hover:border-[#3b82f6]/50 transition-colors shadow-sm relative">
                    <div className="flex justify-between items-start mb-2 gap-2">
                       <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded-full bg-[color:var(--border)] flex items-center justify-center text-xs font-bold text-[color:var(--text)]">
                           {author?.full_name?.charAt(0) || '?'}
                         </div>
                         <span className="text-sm font-semibold text-[color:var(--text)] truncate max-w-[140px]">{author?.full_name || 'Сотрудник'}</span>
                       </div>
                       <div className="flex items-center gap-1.5 shrink-0 bg-[#3b82f6]/10 text-[#3b82f6] px-2 py-0.5 rounded-md text-xs font-bold">
                         <Clock size={12} /> {report.hours_spent} ч.
                       </div>
                    </div>
                    
                    <div className="text-[10px] font-bold text-[color:var(--text-muted)] uppercase tracking-wider mb-1 truncate">
                      {projName}{taskTitle}
                    </div>

                    <p className="text-[13px] text-[color:var(--text)] mt-2 leading-relaxed italic border-l-2 border-[#3b82f6] pl-2">
                      «{report.content}»
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
