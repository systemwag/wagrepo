'use client'

import { useState } from 'react'
import { Send, Clock, Check, AlertCircle, Mic, MicOff } from 'lucide-react'
import { createDirectTask } from '@/lib/actions/tasks'

interface Employee {
  id: string
  full_name: string
  position: string | null
}

interface Props {
  employees: Employee[]
}

export default function QuickTaskForm({ employees }: Props) {
  const [text, setText] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [deadline, setDeadline] = useState<'today' | 'tomorrow' | 'friday' | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)

  function getDeadlineDate(preset: 'today' | 'tomorrow' | 'friday'): string {
    const d = new Date()
    if (preset === 'tomorrow') d.setDate(d.getDate() + 1)
    if (preset === 'friday') {
      const day = d.getDay()
      const diff = (day <= 5) ? (5 - day) : (12 - day)
      d.setDate(d.getDate() + diff)
    }
    return d.toISOString().split('T')[0]
  }

  function toggleListening() {
    if (isListening) {
      setIsListening(false)
      // Встроенный SpeechRecognition остановится по таймауту или можно форсировать,
      // но для надежности просто снимаем UI флаг (onend сработает сам)
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Ваш браузер не поддерживает голосовой ввод. Используйте Chrome, Edge или Safari.')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'ru-RU'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
      }
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setText(prev => prev ? `${prev} ${transcript}` : transcript)
        setIsListening(false)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        if (event.error !== 'no-speech') {
          setError('Ошибка микрофона: ' + event.error)
        }
      }

      recognition.onend = () => setIsListening(false)

      recognition.start()
    } catch (err) {
      console.error(err)
      setIsListening(false)
      setError('Не удалось запустить микрофон. Проверьте разрешения в браузере.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) { setError('Введите текст поручения'); return }
    if (!assigneeId) { setError('Выберите кому'); return }
    if (!deadline) { setError('Выберите срок'); return }

    setLoading(true)
    setError(null)
    
    // Генерируем заголовок из первых 40 символов
    const generatedTitle = text.length > 40 ? text.substring(0, 40) + '...' : text

    const result = await createDirectTask({
      title: generatedTitle,
      description: text,
      assignee_id: assigneeId,
      priority: 'high',
      deadline: getDeadlineDate(deadline),
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setText('')
      setAssigneeId('')
      setDeadline(null)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" style={{ background: 'var(--surface)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)' }}>
      {/* Большое поле для ввода поручения */}
      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Напишите задачу (или надиктуйте голосом)..."
          rows={3}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderColor: isListening ? 'var(--green)' : 'var(--border)',
            boxShadow: isListening ? '0 0 0 1px var(--green)' : 'none',
            borderRadius: '16px',
            outline: 'none',
            fontSize: '1.2rem',
            color: 'var(--text)',
            resize: 'none',
            fontFamily: 'inherit',
            padding: '16px 20px',
            paddingRight: '60px',
            lineHeight: 1.5,
            transition: 'all 0.2s ease',
          }}
        />
        
        {/* Кнопка микрофона */}
        <button
          type="button"
          onClick={toggleListening}
          className="absolute right-3 top-3 p-3 rounded-xl transition-all flex items-center justify-center"
          title="Запуск голосового ввода"
          style={{
            background: isListening ? 'var(--green)' : 'rgba(255,255,255,0.05)',
            color: isListening ? '#fff' : 'var(--text-muted)',
            animation: isListening ? 'pulse 2s infinite' : 'none',
          }}
        >
          {isListening ? <Mic size={22} className="animate-pulse" /> : <MicOff size={22} />}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Выбор сотрудника */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-[color:var(--text-muted)] uppercase tracking-wider mb-3">
            Кому поручить (свайп):
          </label>
          <div 
            className="flex overflow-x-auto gap-2 pb-2" 
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              // Для Webkit (Chrome/Safari) скрытие скроллбара будет работать через CSS классы, 
              // но мы добавим inline стиль для надежности где можно
            }}
          >
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            
            {employees.map(emp => {
              const selected = assigneeId === emp.id
              const initials = emp.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
              const firstName = emp.full_name.split(' ')[0]

              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setAssigneeId(emp.id)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 p-2 rounded-2xl transition-all"
                  style={{
                    width: '72px',
                    background: selected ? 'var(--green-glow)' : 'transparent',
                    border: `1px solid ${selected ? 'rgba(34,197,94,0.3)' : 'transparent'}`,
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-sm"
                    style={{
                      background: selected ? 'var(--green)' : 'var(--surface-2)',
                      color: selected ? '#fff' : 'var(--text-muted)',
                      border: `2px solid ${selected ? 'var(--green)' : 'var(--border)'}`,
                    }}
                  >
                    {initials}
                  </div>
                  <span 
                    className="text-xs truncate w-full text-center font-medium"
                    style={{ color: selected ? 'var(--green)' : 'var(--text-muted)' }}
                  >
                    {firstName}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Быстрые сроки */}
        <div className="flex-[1.5]">
          <label className="block text-xs font-semibold text-[color:var(--text-muted)] uppercase tracking-wider mb-3">
            Срок:
          </label>
          <div className="flex gap-2">
            {[
              { id: 'today', label: 'Сегодня' },
              { id: 'tomorrow', label: 'Завтра' },
              { id: 'friday', label: 'Пятница' },
            ].map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDeadline(d.id as any)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: '12px',
                  background: deadline === d.id ? 'var(--green-glow)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${deadline === d.id ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                  color: deadline === d.id ? 'var(--green)' : 'var(--text-muted)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'all 0.15s ease'
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Уведомления */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-red-400 bg-red-400/10 border border-red-400/20 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-green-400 bg-green-400/10 border border-green-400/20 text-sm font-medium">
          <Check size={16} /> Поручение мгновенно отправлено исполнителю!
        </div>
      )}

      {/* Кнопка отправки */}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-bold text-lg transition-all"
        style={{
          background: 'var(--green)',
          opacity: loading ? 0.7 : 1,
          boxShadow: '0 4px 14px 0 rgba(34, 197, 94, 0.39)',
        }}
      >
        {loading ? <Clock size={20} /> : <Send size={20} />}
        {loading ? 'Отправляем...' : 'Отправить поручение (⚡)'}
      </button>

    </form>
  )
}
