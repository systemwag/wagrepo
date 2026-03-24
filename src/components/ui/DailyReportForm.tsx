'use client'

import { useState } from 'react'
import { Send, Clock, Check, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Task {
  id: string
  title: string
  project_name?: string
}

interface Props {
  myTasks: Task[]
  userId: string
}

export default function DailyReportForm({ myTasks, userId }: Props) {
  const [taskId, setTaskId] = useState(myTasks[0]?.id || '')
  const [content, setContent] = useState('')
  const [hoursSpent, setHoursSpent] = useState<string>('1')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!taskId) { setError('Выберите задачу'); return }
    if (!content.trim()) { setError('Опишите проделанную работу'); return }
    if (isNaN(Number(hoursSpent)) || Number(hoursSpent) <= 0) { setError('Укажите корректные часы'); return }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase
      .from('task_reports')
      .insert({
        task_id: taskId,
        author_id: userId,
        content: content.trim(),
        hours_spent: Number(hoursSpent),
      })

    setLoading(false)

    if (insertError) {
      console.error(insertError)
      setError(insertError.message || 'Ошибка сохранения')
    } else {
      setSuccess(true)
      setContent('')
      setHoursSpent('1')
      // Искусственная перезагрузка страницы для обновления серверного компонента списка
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
          <Clock size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[color:var(--text)]">Мой отчет за день</h2>
          <p className="text-xs text-[color:var(--text-muted)]">Что было сделано и есть ли блокеры?</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[color:var(--text-muted)] uppercase tracking-wider mb-2">
          По какой задаче:
        </label>
        <div className="flex bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-xl overflow-hidden p-1">
          <select
            value={taskId}
            onChange={e => setTaskId(e.target.value)}
            className="w-full bg-transparent text-[color:var(--text)] text-sm outline-none px-3 py-2 cursor-pointer appearance-none"
            disabled={myTasks.length === 0}
          >
            {myTasks.length === 0 && (
              <option value="" disabled className="bg-[color:var(--surface)] text-[color:var(--text-muted)]">
                У вас нет активных задач
              </option>
            )}
            {myTasks.map(task => (
              <option key={task.id} value={task.id} className="bg-[color:var(--surface)] text-[color:var(--text)]">
                {task.project_name ? `[${task.project_name}] ` : ''}{task.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-[3]">
          <label className="block text-xs font-semibold text-[color:var(--text-muted)] uppercase tracking-wider mb-2">
            Результат / Блокеры:
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Например: Закончил чертеж, жду подтверждения от ПТО..."
            rows={3}
            className="w-full rounded-xl border p-3 text-sm outline-none resize-none transition-colors focus:border-blue-500/50"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-[color:var(--text-muted)] uppercase tracking-wider mb-2 text-center">
            Часы:
          </label>
          <input
            type="number"
            value={hoursSpent}
            onChange={e => setHoursSpent(e.target.value)}
            step="0.5"
            min="0.5"
            max="12"
            className="w-full rounded-xl border p-3 text-lg font-bold outline-none text-center h-[76px]"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-red-400 bg-red-400/10 border border-red-400/20 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-green-400 bg-green-400/10 border border-green-400/20 text-sm font-medium">
          <Check size={16} /> Отчет отправлен! Обновляем страницу...
        </div>
      )}

      <button
        type="submit"
        disabled={loading || myTasks.length === 0}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold transition-all"
        style={{
          background: myTasks.length === 0 ? 'var(--border)' : '#3b82f6',
          opacity: (loading || myTasks.length === 0) ? 0.7 : 1,
        }}
      >
        {loading ? <Clock size={20} /> : <Send size={20} />}
        {loading ? 'Отправка...' : 'Отправить отчет'}
      </button>
    </form>
  )
}
