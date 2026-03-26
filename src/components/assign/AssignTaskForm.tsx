'use client'

import { useState, useRef, useEffect } from 'react'
import { User, AlertCircle, Check, Send, Clock, Mic, MicOff, CalendarDays, ChevronLeft, ChevronRight, X, Crown } from 'lucide-react'
import { createDirectTaskBulk } from '@/lib/actions/tasks'

interface Employee {
  id: string
  full_name: string
  position: string | null
}

interface Props {
  employees: Employee[]
  directors: Employee[]
}

const PRIORITIES = [
  { value: 'low',      label: 'Низкий',    color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)', activeBg: 'rgba(148,163,184,0.18)', activeBorder: 'rgba(148,163,184,0.5)' },
  { value: 'medium',   label: 'Средний',   color: '#60a5fa',           bg: 'rgba(255,255,255,0.06)', activeBg: 'rgba(96,165,250,0.15)',  activeBorder: 'rgba(96,165,250,0.5)'  },
  { value: 'high',     label: 'Высокий',   color: '#fb923c',           bg: 'rgba(255,255,255,0.06)', activeBg: 'rgba(251,146,60,0.15)',  activeBorder: 'rgba(251,146,60,0.5)'  },
  { value: 'critical', label: 'Критичный', color: '#f87171',           bg: 'rgba(255,255,255,0.06)', activeBg: 'rgba(248,113,113,0.15)', activeBorder: 'rgba(248,113,113,0.5)' },
] as const

const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const RU_DAYS   = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

type Priority = 'low' | 'medium' | 'high' | 'critical'
type DeadlinePreset = 'today' | 'tomorrow' | 'custom'

function getPresetDate(preset: 'today' | 'tomorrow'): string {
  const d = new Date()
  if (preset === 'tomorrow') d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function toIso(y: number, m: number, day: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function AssignTaskForm({ employees, directors }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [priority, setPriority] = useState<Priority>('medium')
  const [deadline, setDeadline] = useState('')
  const [activePreset, setActivePreset] = useState<DeadlinePreset | null>(null)
  const [calOpen, setCalOpen] = useState(false)
  const today = new Date()
  const parsed = deadline ? new Date(deadline + 'T00:00:00') : null
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const calRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function toggleListening() {
    if (isListening) {
      setIsListening(false)
      return
    }

    type SpeechRecognitionAPI = new () => {
      lang: string; continuous: boolean; interimResults: boolean; start(): void
      onstart: (() => void) | null
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
      onerror: ((e: { error: string }) => void) | null
      onend: (() => void) | null
    }
    type WindowWithSpeech = Window & { SpeechRecognition?: SpeechRecognitionAPI; webkitSpeechRecognition?: SpeechRecognitionAPI }
    const SpeechRecognition = (window as WindowWithSpeech).SpeechRecognition || (window as WindowWithSpeech).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Ваш браузер не поддерживает голосовой ввод. Используйте Chrome, Edge или Safari.')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'ru-RU'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => { setIsListening(true); setError(null) }

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setDescription(prev => prev ? `${prev} ${transcript}` : transcript)
        setIsListening(false)
      }

      recognition.onerror = (event) => {
        setIsListening(false)
        if (event.error !== 'no-speech') setError('Ошибка микрофона: ' + event.error)
      }

      recognition.onend = () => setIsListening(false)
      recognition.start()
    } catch {
      setIsListening(false)
      setError('Не удалось запустить микрофон. Проверьте разрешения в браузере.')
    }
  }

  function handlePreset(preset: 'today' | 'tomorrow') {
    setActivePreset(preset)
    setDeadline(getPresetDate(preset))
    setCalOpen(false)
  }

  function selectCalDay(day: number) {
    const iso = toIso(viewYear, viewMonth, day)
    setDeadline(iso)
    setActivePreset('custom')
    setCalOpen(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Build Mon-first calendar grid
  const firstDow  = new Date(viewYear, viewMonth, 1).getDay()
  const offset    = firstDow === 0 ? 6 : firstDow - 1
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate()
  const calCells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ]
  while (calCells.length % 7 !== 0) calCells.push(null)

  const isToday    = (d: number) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
  const isSelected = (d: number) => !!(parsed && d === parsed.getDate() && viewMonth === parsed.getMonth() && viewYear === parsed.getFullYear())

  const customLabel = parsed && activePreset === 'custom'
    ? parsed.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : 'Выбрать дату'

  function toggleAssignee(id: string) {
    setAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Введите название задачи'); return }
    if (assigneeIds.length === 0) { setError('Выберите хотя бы одного исполнителя'); return }

    setLoading(true)
    setError(null)

    const result = await createDirectTaskBulk({
      title,
      description,
      assignee_ids: assigneeIds,
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
      setAssigneeIds([])
      setPriority('medium')
      setDeadline('')
      setActivePreset(null)
      setCalOpen(false)
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

      {/* Description + voice */}
      <div className="relative">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Описание или заметка (или надиктуйте голосом)..."
          rows={3}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${isListening ? 'var(--green)' : 'var(--border)'}`,
            boxShadow: isListening ? '0 0 0 1px var(--green)' : 'none',
            borderRadius: '12px',
            outline: 'none',
            fontSize: '0.875rem',
            color: 'var(--text)',
            resize: 'none',
            fontFamily: 'inherit',
            padding: '12px 14px',
            paddingRight: '52px',
            lineHeight: 1.6,
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
        />
        <button
          type="button"
          onClick={toggleListening}
          title={isListening ? 'Остановить запись' : 'Надиктовать голосом'}
          className="absolute right-2.5 top-2.5 p-2.5 rounded-xl transition-all flex items-center justify-center"
          style={{
            background: isListening ? 'var(--green)' : 'rgba(255,255,255,0.05)',
            color: isListening ? '#fff' : 'var(--text-muted)',
          }}
        >
          {isListening ? <Mic size={18} className="animate-pulse" /> : <MicOff size={18} />}
        </button>
      </div>

      {/* Assignees — горизонтальный свайп, мульти-выбор */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <User size={15} color="var(--text-muted)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Сотрудники
          </span>
          {assigneeIds.length > 0 && (
            <span style={{
              fontSize: '0.75rem', fontWeight: 700,
              background: 'var(--green-glow)', color: 'var(--green)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: '20px', padding: '1px 8px', marginLeft: '4px',
            }}>
              {assigneeIds.length}
            </span>
          )}
        </div>
        <AvatarRow people={employees} selected={assigneeIds} onToggle={toggleAssignee} accent="green" />

        {/* Директора */}
        {directors.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0 12px' }}>
              <Crown size={14} color="var(--text-muted)" style={{ opacity: 0.7 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Руководители
              </span>
            </div>
            <AvatarRow people={directors} selected={assigneeIds} onToggle={toggleAssignee} accent="amber" />
          </>
        )}
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

      {/* Deadline — быстрые кнопки + всплывающий календарь */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Срок выполнения
          </span>
        </div>
        <div ref={calRef} className="relative" style={{ display: 'flex', gap: '8px' }}>
          {/* Сегодня */}
          {(['today', 'tomorrow'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => handlePreset(p)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: '12px',
                background: activePreset === p ? 'var(--green-glow)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activePreset === p ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                color: activePreset === p ? 'var(--green)' : 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit',
              }}
            >
              {p === 'today' ? 'Сегодня' : 'Завтра'}
            </button>
          ))}

          {/* Выбрать дату — открывает popup */}
          <button
            type="button"
            onClick={() => setCalOpen(o => !o)}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: '12px',
              background: activePreset === 'custom' ? 'var(--green-glow)' : calOpen ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activePreset === 'custom' ? 'rgba(34,197,94,0.4)' : calOpen ? 'var(--border-2)' : 'var(--border)'}`,
              color: activePreset === 'custom' ? 'var(--green)' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <CalendarDays size={14} />
            {customLabel}
            {activePreset === 'custom' && deadline && (
              <span
                onClick={e => { e.stopPropagation(); setDeadline(''); setActivePreset(null) }}
                style={{ display: 'flex', alignItems: 'center', marginLeft: '2px', opacity: 0.7 }}
              >
                <X size={12} />
              </span>
            )}
          </button>

          {/* Всплывающий календарь */}
          {calOpen && (
            <div
              className="absolute z-50 rounded-2xl p-4"
              style={{
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: '300px',
                background: 'var(--surface)',
                border: '1px solid var(--border-2)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
              }}
            >
              {/* Навигация */}
              <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={prevMonth}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <select value={viewMonth} onChange={e => setViewMonth(Number(e.target.value))}
                    className="text-sm font-semibold bg-transparent border-none outline-none cursor-pointer"
                    style={{ color: 'var(--text)' }}>
                    {RU_MONTHS.map((m, i) => (
                      <option key={i} value={i} style={{ background: 'var(--surface)' }}>{m}</option>
                    ))}
                  </select>
                  <select value={viewYear} onChange={e => setViewYear(Number(e.target.value))}
                    className="text-sm font-semibold bg-transparent border-none outline-none cursor-pointer"
                    style={{ color: 'var(--text)' }}>
                    {Array.from({ length: 10 }, (_, i) => today.getFullYear() + i).map(y => (
                      <option key={y} value={y} style={{ background: 'var(--surface)' }}>{y}</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={nextMonth}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Дни недели */}
              <div className="grid grid-cols-7 mb-2">
                {RU_DAYS.map(d => (
                  <div key={d} className="text-center text-xs font-semibold py-1"
                    style={{ color: d === 'Сб' || d === 'Вс' ? 'rgba(99,102,241,0.7)' : 'var(--text-dim)' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Ячейки */}
              <div className="grid grid-cols-7 gap-0.5">
                {calCells.map((day, idx) => {
                  if (!day) return <div key={idx} />
                  const sel = isSelected(day)
                  const tod = isToday(day)
                  const col = idx % 7
                  const isWeekend = col === 5 || col === 6
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectCalDay(day)}
                      className="w-full aspect-square rounded-xl text-sm font-medium flex items-center justify-center transition-all"
                      style={{
                        background: sel ? 'var(--green)' : tod ? 'var(--green-glow)' : 'transparent',
                        color: sel ? '#000' : tod ? 'var(--green)' : isWeekend ? 'rgba(99,102,241,0.8)' : 'var(--text)',
                        fontWeight: sel || tod ? 700 : 400,
                        border: tod && !sel ? '1px solid rgba(34,197,94,0.4)' : '1px solid transparent',
                      }}
                      onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                      onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = tod ? 'var(--green-glow)' : 'transparent' }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              {/* Футер */}
              <div className="mt-3 pt-3 flex justify-between items-center" style={{ borderTop: '1px solid var(--border)' }}>
                <button type="button"
                  onClick={() => { setDeadline(''); setActivePreset(null); setCalOpen(false) }}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                >
                  Очистить
                </button>
                <button type="button"
                  onClick={() => selectCalDay(today.getDate())}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ color: 'var(--green)', background: 'var(--green-glow)' }}
                >
                  Сегодня
                </button>
              </div>
            </div>
          )}
        </div>
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
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px', borderRadius: '12px',
          background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
          color: 'var(--green)', fontSize: '0.875rem', fontWeight: 500,
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
            {assigneeIds.length > 1 ? `Поручить ${assigneeIds.length} сотрудникам` : 'Поручить'}
          </>
        )}
      </button>
    </form>
  )
}

// ─── Горизонтальный ряд аватаров с мульти-выбором ────────────────────────────
function AvatarRow({
  people,
  selected,
  onToggle,
  accent,
}: {
  people: Employee[]
  selected: string[]
  onToggle: (id: string) => void
  accent: 'green' | 'amber'
}) {
  const color  = accent === 'green' ? 'var(--green)'                : '#f59e0b'
  const glow   = accent === 'green' ? 'var(--green-glow)'           : 'rgba(245,158,11,0.12)'
  const border = accent === 'green' ? 'rgba(34,197,94,0.3)'         : 'rgba(245,158,11,0.35)'
  const bg     = accent === 'green' ? 'var(--green)'                : '#f59e0b'
  const fg     = accent === 'green' ? '#fff'                        : '#000'

  return (
    <div
      className="flex overflow-x-auto gap-2 pb-2"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {people.map(person => {
        const sel      = selected.includes(person.id)
        const initials = person.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        const firstName = person.full_name.split(' ')[0]
        return (
          <button
            key={person.id}
            type="button"
            onClick={() => onToggle(person.id)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 p-2 rounded-2xl transition-all"
            style={{
              width: '72px',
              background: sel ? glow : 'transparent',
              border: `1px solid ${sel ? border : 'transparent'}`,
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-sm relative"
              style={{
                background: sel ? bg : 'var(--surface-2)',
                color: sel ? fg : 'var(--text-muted)',
                border: `2px solid ${sel ? bg : 'var(--border)'}`,
              }}
            >
              {initials}
              {sel && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: bg, border: '2px solid var(--surface)' }}>
                  <Check size={9} color={fg} strokeWidth={3} />
                </span>
              )}
            </div>
            <span
              className="text-xs truncate w-full text-center font-medium"
              style={{ color: sel ? color : 'var(--text-muted)' }}
            >
              {firstName}
            </span>
          </button>
        )
      })}
    </div>
  )
}
