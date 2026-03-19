'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DatePicker from '@/components/ui/DatePicker'
import {
  FolderOpen,
  Building2,
  FileText,
  DollarSign,
  CalendarDays,
  CalendarCheck,
  UserCog,
  AlignLeft,
  CheckCircle2,
  Loader2,
  X,
  Plus,
} from 'lucide-react'

type Employee = { id: string; full_name: string; position: string | null }

export default function NewProjectForm({ employees }: { employees: Employee[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    client_name: '',
    contract_number: '',
    budget: '',
    start_date: '',
    deadline: '',
    description: '',
    manager_id: '',
  })

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name:            form.name.trim(),
        client_name:     form.client_name || null,
        contract_number: form.contract_number || null,
        budget:          form.budget ? Number(form.budget.replace(/\s/g, '')) : null,
        start_date:      form.start_date || null,
        deadline:        form.deadline || null,
        description:     form.description || null,
        created_by:      user!.id,
        manager_id:      form.manager_id || user!.id,
        project_type:    'design',
      })
      .select('id')
      .single()

    if (!error && project) {
      await supabase.rpc('create_design_stages', { p_project_id: project.id })
      router.push(`/dashboard/projects/${project.id}`)
      router.refresh()
    }

    setLoading(false)
  }

  const stageColors = [
    '#22c55e', '#3b82f6', '#a855f7', '#f59e0b',
    '#06b6d4', '#f97316', '#ec4899', '#6366f1',
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Основная информация ── */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--green-glow)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <FolderOpen className="w-5 h-5" style={{ color: 'var(--green)' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Основная информация</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Название, заказчик, договор и сроки</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Название */}
          <Field label="Название проекта" required icon={<FileText className="w-3.5 h-3.5" />}>
            <input
              required
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Например: Административный корпус ТОО «...»"
              className="input text-base"
              style={{ fontWeight: 500 }}
            />
          </Field>

          {/* Заказчик + Договор */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Заказчик" icon={<Building2 className="w-3.5 h-3.5" />}>
              <input
                value={form.client_name}
                onChange={e => setField('client_name', e.target.value)}
                placeholder="Название организации"
                className="input"
              />
            </Field>
            <Field label="Номер договора" icon={<FileText className="w-3.5 h-3.5" />}>
              <input
                value={form.contract_number}
                onChange={e => setField('contract_number', e.target.value)}
                placeholder="ДГ-2025-001"
                className="input"
              />
            </Field>
          </div>

          {/* Бюджет + Даты */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Бюджет (₸)" icon={<DollarSign className="w-3.5 h-3.5" />}>
              <input
                type="text"
                inputMode="numeric"
                value={form.budget}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d]/g, '')
                  const formatted = raw ? Number(raw).toLocaleString('ru-RU') : ''
                  setField('budget', formatted)
                }}
                placeholder="0"
                className="input"
              />
            </Field>
            <Field label="Дата начала" icon={<CalendarDays className="w-3.5 h-3.5" />}>
              <DatePicker
                value={form.start_date}
                onChange={v => setField('start_date', v)}
                placeholder="дд.мм.гггг"
              />
            </Field>
            <Field label="Дедлайн" icon={<CalendarCheck className="w-3.5 h-3.5" />}>
              <DatePicker
                value={form.deadline}
                onChange={v => setField('deadline', v)}
                placeholder="дд.мм.гггг"
              />
            </Field>
          </div>

          {/* Менеджер */}
          <Field label="Менеджер проекта" icon={<UserCog className="w-3.5 h-3.5" />}>
            <div className="flex flex-wrap gap-2">
              {employees.map(emp => {
                const selected = form.manager_id === emp.id
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setField('manager_id', selected ? '' : emp.id)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all"
                    style={{
                      background: selected ? 'var(--green-glow)' : 'var(--surface-2)',
                      border: `1px solid ${selected ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                      color: selected ? 'var(--green)' : 'var(--text)',
                    }}
                    onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)' }}
                    onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: selected ? 'rgba(34,197,94,0.25)' : 'var(--border-2)',
                        color: selected ? 'var(--green)' : 'var(--text-muted)',
                      }}
                    >
                      {emp.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium leading-none">{emp.full_name}</div>
                      {emp.position && (
                        <div className="text-xs mt-0.5" style={{ color: selected ? 'rgba(34,197,94,0.7)' : 'var(--text-muted)' }}>
                          {emp.position}
                        </div>
                      )}
                    </div>
                    {selected && (
                      <svg className="w-4 h-4 ml-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
            {!form.manager_id && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
                Если не выбрать — назначится текущий пользователь
              </p>
            )}
          </Field>

          {/* Описание */}
          <Field label="Описание проекта" icon={<AlignLeft className="w-3.5 h-3.5" />}>
            <textarea
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Краткое описание, цели и особенности проекта..."
              rows={3}
              className="input resize-none"
            />
          </Field>
        </div>
      </section>

      {/* ── Этапы ── */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <CheckCircle2 className="w-5 h-5" style={{ color: '#818cf8' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Этапы проектирования</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              8 этапов создадутся автоматически по стандарту WAG
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {STAGE_NAMES.map((name, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: `${stageColors[i]}22`, color: stageColors[i], border: `1px solid ${stageColors[i]}44` }}
              >
                {i + 1}
              </div>
              <span className="text-sm font-medium flex-1" style={{ color: 'var(--text)' }}>{name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Кнопки ── */}
      <div className="flex gap-3 pb-8">
        <a
          href="/dashboard/projects"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        >
          <X className="w-4 h-4" />
          Отмена
        </a>
        <button
          type="submit"
          disabled={loading || !form.name.trim()}
          className="flex-1 flex items-center justify-center gap-2 btn-green disabled:opacity-40 text-sm font-semibold py-3"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Создание...</>
          ) : (
            <><Plus className="w-4 h-4" />Создать проект</>
          )}
        </button>
      </div>
    </form>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAGE_NAMES = [
  'Заключение договора',
  'Изыскательные работы',
  'Получение исходных данных',
  'Разработка ПСД',
  'Согласование проекта',
  'Разработка ОБОС',
  'Государственная экспертиза',
  'Выдача окончательной версии ПСД',
]

function Field({ label, required, icon, children }: {
  label: string
  required?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 mb-2">
        {icon && <span style={{ color: 'var(--text-dim)' }}>{icon}</span>}
        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {required && <span className="text-xs" style={{ color: 'var(--green)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
