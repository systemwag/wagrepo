import { createClient, getSession } from '@/lib/supabase/server'
import Link from 'next/link'

const statusLabel: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Готово',
}

const statusStyle: Record<string, React.CSSProperties> = {
  todo: { background: 'var(--surface-2)', color: 'var(--text-muted)' },
  in_progress: { background: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
  review: { background: 'rgba(234,179,8,0.12)', color: '#ca8a04' },
  done: { background: 'var(--green-glow)', color: 'var(--green)' },
}

const priorityColor: Record<string, string> = {
  low: 'var(--text-muted)',
  medium: '#60a5fa',
  high: '#fb923c',
  critical: '#f87171',
}

const priorityLabel: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
}

export default async function TasksPage() {
  const [supabase, session] = await Promise.all([createClient(), getSession()])
  const userId = session!.user.id
  const taskQuery = `id, title, status, priority, deadline, project:projects(id, name)`

  const [{ data: tasks }, { data: doneTasks }] = await Promise.all([
    supabase.from('tasks').select(taskQuery).eq('assignee_id', userId).neq('status', 'done').order('deadline', { ascending: true, nullsFirst: false }),
    supabase.from('tasks').select(taskQuery).eq('assignee_id', userId).eq('status', 'done').order('updated_at', { ascending: false }).limit(10),
  ])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Мои задачи</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{tasks?.length ?? 0} активных задач</p>
      </div>

      {/* Активные задачи */}
      {tasks && tasks.length > 0 ? (
        <div className="card mb-6">
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-medium" style={{ color: 'var(--text)' }}>Активные</h2>
          </div>
          <div>
            {tasks.map((task, i) => {
              const isOverdue = task.deadline && new Date(task.deadline) < new Date()
              return (
                <div key={task.id} className="px-6 py-4 flex items-center justify-between gap-4"
                  style={{ borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : undefined }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{task.title}</p>
                    {(task.project as any)?.name && (
                      <Link
                        href={`/dashboard/projects/${(task.project as any).id}`}
                        className="text-xs mt-0.5 inline-block transition-colors hover-green"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {(task.project as any).name}
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-xs font-medium" style={{ color: priorityColor[task.priority] }}>
                      {priorityLabel[task.priority]}
                    </span>
                    {task.deadline && (
                      <span className="text-xs" style={{ color: isOverdue ? '#f87171' : 'var(--text-muted)' }}>
                        {isOverdue ? 'Просрочено · ' : ''}{new Date(task.deadline).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={statusStyle[task.status]}>
                      {statusLabel[task.status]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card py-16 text-center mb-6">
          <p style={{ color: 'var(--text-muted)' }}>Нет активных задач</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Отличная работа!</p>
        </div>
      )}

      {/* Завершённые */}
      {doneTasks && doneTasks.length > 0 && (
        <div className="card">
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-medium" style={{ color: 'var(--text)' }}>Завершённые</h2>
          </div>
          <div>
            {doneTasks.map((task, i) => (
              <div key={task.id} className="px-6 py-4 flex items-center justify-between gap-4"
                style={{ borderBottom: i < doneTasks.length - 1 ? '1px solid var(--border)' : undefined }}
              >
                <p className="text-sm line-through" style={{ color: 'var(--text-muted)' }}>{task.title}</p>
                {(task.project as any)?.name && (
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-dim)' }}>{(task.project as any).name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
