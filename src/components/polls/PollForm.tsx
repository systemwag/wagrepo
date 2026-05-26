'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2, Plus, X, Crown, Briefcase, User as UserIcon, Search } from 'lucide-react'
import DatePicker from '@/components/ui/DatePicker'
import { getFirstName } from '@/lib/utils/name'

export type Employee = { id: string; full_name: string; position: string | null; role: string }
export type PollFormPollType = 'single_choice' | 'multiple_choice' | 'text'
export type PollFormAudience = 'all' | 'specific'

export type PollFormPayload = {
  question:   string
  type:       PollFormPollType
  options?:   { id: string; label: string }[]
  audience:   PollFormAudience
  target_ids?: string[]
  deadline:   string
}

export type PollFormInitial = {
  question: string
  type: PollFormPollType
  options: { id: string; label: string }[] | null
  audience: PollFormAudience
  target_ids: string[]
  /** YYYY-MM-DD (date part of deadline в Asia/Oral). */
  deadline: string
}

type Props = {
  employees: Employee[]
  /** Если передано — форма работает в режиме редактирования. */
  initial?: PollFormInitial
  /** Текст на сабмит-кнопке. По умолчанию — «Опубликовать». */
  submitLabel?: string
  /** Куда вернуться после успеха. */
  redirectTo: string
  /** Server Action — createPoll или updatePoll-wrapper. */
  onSubmit: (payload: PollFormPayload) => Promise<{ error: string | null }>
}

// Короткие буквенные id вариантов: a, b, c, …
function optionId(i: number) {
  return String.fromCharCode(97 + i)
}

export default function PollForm({ employees, initial, submitLabel, redirectTo, onSubmit }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [question, setQuestion] = useState(initial?.question ?? '')
  const [type, setType]         = useState<PollFormPollType>(initial?.type ?? 'single_choice')
  const [options, setOptions]   = useState<string[]>(
    initial?.options?.map(o => o.label) ?? ['', '']
  )
  const [audience, setAudience] = useState<PollFormAudience>(initial?.audience ?? 'all')
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.target_ids ?? []))
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [search, setSearch]     = useState('')
  // refs на инпуты опций — для автофокуса при «Добавить вариант»
  const optionRefs = useRef<(HTMLInputElement | null)[]>([])

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      (e.position?.toLowerCase().includes(q) ?? false)
    )
  }, [employees, search])

  const grouped = useMemo(() => groupByRole(filteredEmployees), [filteredEmployees])

  function addOption() {
    if (options.length >= 20) return
    setOptions(o => {
      const next = [...o, '']
      // Фокус на новый input — после mount'а через requestAnimationFrame.
      requestAnimationFrame(() => optionRefs.current[next.length - 1]?.focus())
      return next
    })
  }
  function removeOption(i: number) {
    if (options.length <= 2) return
    setOptions(o => o.filter((_, idx) => idx !== i))
  }
  function setOptionLabel(i: number, v: string) {
    setOptions(o => o.map((label, idx) => idx === i ? v : label))
  }

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function selectAll() {
    // Если активен поиск — добавляем только тех, кто в результатах
    // (intuitive: «выбрать всех видимых»). Без поиска — реально всех.
    setSelected(prev => {
      const next = new Set(prev)
      for (const e of filteredEmployees) next.add(e.id)
      return next
    })
  }
  function clearSelected() {
    setSelected(new Set())
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) { setError('Введите формулировку вопроса'); return }
    if (!deadline) { setError('Укажите дедлайн ответа'); return }
    if (audience === 'specific' && selected.size === 0) {
      setError('Выберите адресатов или переключите на «Все»')
      return
    }

    const payload: PollFormPayload = {
      question: trimmedQuestion,
      type,
      audience,
      deadline,
    }
    if (type !== 'text') {
      const labels = options.map(o => o.trim()).filter(Boolean)
      if (labels.length < 2) { setError('Нужно минимум 2 варианта ответа'); return }
      // Регистронезависимый дедуп: «Да», «да», «ДА» — это одно.
      const seen = new Set<string>()
      for (const label of labels) {
        const key = label.toLowerCase()
        if (seen.has(key)) { setError(`Вариант «${label}» повторяется`); return }
        seen.add(key)
      }
      payload.options = labels.map((label, i) => ({ id: optionId(i), label }))
    }
    if (audience === 'specific') {
      payload.target_ids = Array.from(selected)
    }

    startTransition(async () => {
      const res = await onSubmit(payload)
      if (res.error) { setError(res.error); return }
      router.push(redirectTo)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* Вопрос */}
      <div>
        <label className="block text-sm font-medium mb-2 text-text">Вопрос</label>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Например: «Готовы ли вы выйти в субботу?»"
          className="w-full px-4 py-3 rounded-xl border resize-none text-sm focus-ring"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
          required
        />
      </div>

      {/* Тип ответа */}
      <div>
        <label className="block text-sm font-medium mb-2 text-text">Тип ответа</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Тип ответа">
          <TypeChip current={type} value="single_choice"   label="Один вариант"      onChange={setType} />
          <TypeChip current={type} value="multiple_choice" label="Несколько вариантов" onChange={setType} />
          <TypeChip current={type} value="text"            label="Текстовый ответ"   onChange={setType} />
        </div>
      </div>

      {/* Варианты ответа — только для choice-типов */}
      {type !== 'text' && (
        <div>
          <label className="block text-sm font-medium mb-2 text-text">Варианты ответа</label>
          <div className="space-y-2">
            {options.map((value, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                  {optionId(i).toUpperCase()}
                </span>
                <input
                  ref={el => { optionRefs.current[i] = el }}
                  type="text"
                  value={value}
                  onChange={e => setOptionLabel(i, e.target.value)}
                  maxLength={200}
                  placeholder={`Вариант ${i + 1}`}
                  aria-label={`Вариант ${i + 1}`}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm focus-ring"
                  style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={options.length <= 2}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-text-dim transition-colors hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Удалить вариант"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            disabled={options.length >= 20}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-text-muted hover-text disabled:opacity-30"
          >
            <Plus size={14} />
            Добавить вариант
          </button>
        </div>
      )}

      {/* Аудитория */}
      <div>
        <label className="block text-sm font-medium mb-2 text-text">Кому адресован</label>
        <div className="grid grid-cols-2 gap-2 mb-3" role="radiogroup" aria-label="Кому адресован">
          <TypeChip current={audience} value="all"      label="Всем сотрудникам" onChange={v => setAudience(v as PollFormAudience)} />
          <TypeChip current={audience} value="specific" label="Выбрать"          onChange={v => setAudience(v as PollFormAudience)} />
        </div>

        {audience === 'specific' && (
          <div className="rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
            {/* Шапка с счётчиком и быстрыми действиями */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3 text-xs text-text-dim">
              <span>Выбрано: <b className="text-text">{selected.size}</b> из {employees.length}</span>
              <div className="flex gap-3">
                <button type="button" onClick={selectAll} className="hover-green">Выбрать всех</button>
                <button type="button" onClick={clearSelected} className="hover-green">Очистить</button>
              </div>
            </div>

            {/* Поле поиска */}
            <div className="px-4 pt-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск по имени или должности…"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border text-sm focus-ring"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-text-dim hover-text"
                    aria-label="Очистить поиск"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Список с ограниченной высотой и скроллом */}
            <div className="max-h-[320px] overflow-y-auto p-4">
              {grouped.length === 0 ? (
                <p className="text-sm text-text-dim text-center py-6">Никого не найдено</p>
              ) : (
                grouped.map(group => (
                  <div key={group.label} className="mb-3 last:mb-0">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-text-dim mb-2">{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map(emp => {
                        const sel = selected.has(emp.id)
                        return (
                          <button
                            type="button"
                            key={emp.id}
                            role="checkbox"
                            aria-checked={sel}
                            onClick={() => toggleSelected(emp.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border"
                            style={{
                              background: sel ? 'color-mix(in oklab, var(--color-green) 15%, transparent)' : 'var(--color-surface)',
                              borderColor: sel ? 'color-mix(in oklab, var(--color-green) 30%, transparent)' : 'var(--color-border)',
                              color: sel ? 'var(--color-green)' : 'var(--color-text)',
                            }}
                          >
                            {sel && <Check size={13} />}
                            <span>{getFirstName(emp.full_name)}</span>
                            {emp.position && <span className="text-xs text-text-dim">— {emp.position}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Дедлайн */}
      <div>
        <label className="block text-sm font-medium mb-2 text-text">Дедлайн ответа</label>
        <DatePicker value={deadline} onChange={setDeadline} placeholder="Выберите дату" />
        <p className="text-xs text-text-dim mt-1.5">Ответы принимаются до конца указанного дня (по времени Уральска).</p>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm" style={{
          background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
          color: 'var(--color-danger)',
          border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)',
        }}>
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          style={{
            background: 'var(--color-green)',
            color: '#000',
          }}
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {submitLabel ?? 'Опубликовать'}
        </button>
      </div>
    </form>
  )
}

function TypeChip<T extends string>({ current, value, label, onChange }: {
  current: T; value: T; label: string; onChange: (v: T) => void
}) {
  const active = current === value
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onChange(value)}
      className="px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-colors text-left"
      style={{
        background: active ? 'color-mix(in oklab, var(--color-green) 12%, transparent)' : 'var(--color-surface-2)',
        borderColor: active ? 'color-mix(in oklab, var(--color-green) 30%, transparent)' : 'var(--color-border)',
        color: active ? 'var(--color-green)' : 'var(--color-text)',
      }}
    >
      {label}
    </button>
  )
}

const ROLE_ORDER: Record<string, number> = { admin: 0, director: 1, manager: 2, employee: 3 }
const ROLE_LABEL: Record<string, { label: string; icon: React.ReactNode }> = {
  admin:    { label: 'Администраторы', icon: <Crown size={12} /> },
  director: { label: 'Директора',      icon: <Crown size={12} /> },
  manager:  { label: 'Менеджеры',      icon: <Briefcase size={12} /> },
  employee: { label: 'Сотрудники',     icon: <UserIcon size={12} /> },
}

function groupByRole(employees: Employee[]): { label: string; items: Employee[] }[] {
  const map = new Map<string, Employee[]>()
  for (const e of employees) {
    const arr = map.get(e.role) ?? []
    arr.push(e)
    map.set(e.role, arr)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (ROLE_ORDER[a] ?? 99) - (ROLE_ORDER[b] ?? 99))
    .map(([role, items]) => ({ label: ROLE_LABEL[role]?.label ?? role, items }))
}
