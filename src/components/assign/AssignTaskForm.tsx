'use client'

import { useState } from 'react'
import { User, AlertCircle, Check, Send, Clock } from 'lucide-react'
import { createDirectTask } from '@/lib/actions/tasks'
import DatePicker from '@/components/ui/DatePicker'

interface Employee {
  id: string
  full_name: string
  position: string | null
}

interface Props {
  employees: Employee[]
}

const PRIORITIES = [
  { value: 'low', label: 'Низкий', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)', activeBg: 'rgba(148,163,184,0.18)', activeBorder: 'rgba(148,163,184,0.5)' },
  { value: 'medium', label: 'Средний', color: '#60a5fa', bg: 'rgba(255,255,255,0.06)', activeBg: 'rgba(96,165,250,0.15)', activeBorder: 'rgba(96,165,250,0.5)' },
  { value: 'high', label: 'Высокий', color: '#fb923c', bg: 'rgba(255,255,255,0.06)', activeBg: 'rgba(251,146,60,0.15)', activeBorder: 'rgba(251,146,60,0.5)' },
  { value: 'critical', label: 'Критичный', color: '#f87171', bg: 'rgba(255,255,255,0.06)', activeBg: 'rgba(248,113,113,0.15)', activeBorder: 'rgba(248,113,113,0.5)' },
] as const

type Priority = 'low' | 'medium' | 'high' | 'critical'

export default function AssignTaskForm({ employees }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Введите название задачи'); return }
    if (!assigneeId) { setError('Выберите исполнителя'); return }

    setLoading(true)
    setError(null)

    const result = await createDirectTask({
      title,
      description,
      assignee_id: assigneeId,
      priority,
      deadline: deadline || null,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setTitle('')
      setDescription('')
      setAssigneeId('')
      setPriority('medium')
      setDeadline('')
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Title */}
      <div>
        <textarea
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Название задачи..."
          rows={2}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text)',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.4,
          }}
        />
        <div style={{ height: '1px', background: 'var(--border)', marginTop: '8px' }} />
      </div>

      {/* Description */}
      <div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Описание или заметка..."
          rows={3}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            outline: 'none',
            fontSize: '0.875rem',
            color: 'var(--text)',
            resize: 'none',
            fontFamily: 'inherit',
            padding: '12px 14px',
            lineHeight: 1.6,
          }}
        />
      </div>

      {/* Assignee */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <User size={15} color="var(--text-muted)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Исполнитель
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {employees.map(emp => {
            const selected = assigneeId === emp.id
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => setAssigneeId(emp.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '16px',
                  border: `1px solid ${selected ? 'var(--green)' : 'var(--border)'}`,
                  background: selected ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: selected ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: selected ? 'var(--green)' : 'var(--text-muted)',
                  flexShrink: 0,
                  border: `1px solid ${selected ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
                }}>
                  {emp.full_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: selected ? 'var(--green)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {emp.full_name}
                  </div>
                  {emp.position && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.position}
                    </div>
                  )}
                </div>
                {selected && <Check size={16} color="var(--green)" style={{ flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Priority */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <AlertCircle size={15} color="var(--text-muted)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Приоритет
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {PRIORITIES.map(p => {
            const selected = priority === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${selected ? p.activeBorder : 'var(--border)'}`,
                  background: selected ? p.activeBg : p.bg,
                  color: selected ? p.color : 'var(--text-muted)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Deadline */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Срок выполнения
          </span>
        </div>
        <DatePicker value={deadline} onChange={setDeadline} placeholder="Выберите дату" />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.3)',
          color: '#f87171',
          fontSize: '0.875rem',
        }}>
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(74,222,128,0.1)',
          border: '1px solid rgba(74,222,128,0.3)',
          color: 'var(--green)',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}>
          <Check size={15} />
          Задание создано
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="btn-green"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px 24px',
          fontSize: '1rem',
          fontWeight: 600,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? (
          <>
            <Clock size={16} />
            Создание...
          </>
        ) : (
          <>
            <Send size={16} />
            Поручить
          </>
        )}
      </button>
    </form>
  )
}
