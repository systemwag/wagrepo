'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Employee = { id: string; full_name: string; position: string | null }

type Stage = {
  name: string
  deadline: string
  assignee_id: string
}

const DEFAULT_STAGES: Stage[] = [
  { name: 'Проектирование', deadline: '', assignee_id: '' },
  { name: 'Строительство', deadline: '', assignee_id: '' },
  { name: 'Приёмка', deadline: '', assignee_id: '' },
  { name: 'Сдача', deadline: '', assignee_id: '' },
]

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
  })
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES)

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function setStageField(index: number, field: keyof Stage, value: string) {
    setStages(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  function addStage() {
    setStages(prev => [...prev, { name: '', deadline: '', assignee_id: '' }])
  }

  function removeStage(index: number) {
    setStages(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: form.name.trim(),
        client_name: form.client_name || null,
        contract_number: form.contract_number || null,
        budget: form.budget ? Number(form.budget) : null,
        start_date: form.start_date || null,
        deadline: form.deadline || null,
        description: form.description || null,
        created_by: user!.id,
        manager_id: user!.id,
      })
      .select('id')
      .single()

    if (!error && project) {
      const stageRows = stages
        .filter(s => s.name.trim())
        .map((s, i) => ({
          project_id: project.id,
          name: s.name.trim(),
          order_index: i,
          deadline: s.deadline || null,
          assignee_id: s.assignee_id || null,
        }))

      if (stageRows.length > 0) {
        await supabase.from('project_stages').insert(stageRows)
      }

      router.push(`/dashboard/projects/${project.id}`)
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Основная информация */}
      <section className="card p-6">
        <h2 className="font-semibold mb-5" style={{ color: 'var(--text)' }}>Основная информация</h2>
        <div className="space-y-4">
          <Field label="Название проекта *">
            <input
              required
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Например: Административный корпус ТОО «...»"
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Заказчик">
              <input value={form.client_name} onChange={e => setField('client_name', e.target.value)} placeholder="Название организации" className="input" />
            </Field>
            <Field label="№ договора">
              <input value={form.contract_number} onChange={e => setField('contract_number', e.target.value)} placeholder="ДГ-2025-001" className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Бюджет (₸)">
              <input type="number" value={form.budget} onChange={e => setField('budget', e.target.value)} placeholder="0" className="input" />
            </Field>
            <Field label="Дата начала">
              <input type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} className="input" />
            </Field>
            <Field label="Дедлайн проекта">
              <input type="date" value={form.deadline} onChange={e => setField('deadline', e.target.value)} className="input" />
            </Field>
          </div>

          <Field label="Описание">
            <textarea
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Краткое описание проекта..."
              rows={3}
              className="input resize-none"
            />
          </Field>
        </div>
      </section>

      {/* Этапы */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Этапы работ</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Укажите этапы, дедлайны и ответственных сотрудников</p>
          </div>
          <button
            type="button"
            onClick={addStage}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl transition-colors"
            style={{ color: 'var(--green)', background: 'var(--green-glow)', border: '1px solid rgba(34,197,94,0.2)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.25)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--green-glow)'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Добавить этап
          </button>
        </div>

        <div className="space-y-3">
          {stages.map((stage, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  {i + 1}
                </div>
                <input
                  value={stage.name}
                  onChange={e => setStageField(i, 'name', e.target.value)}
                  placeholder="Название этапа"
                  className="flex-1 bg-transparent text-sm font-medium outline-none"
                  style={{ color: 'var(--text)' }}
                />
                {stages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStage(i)}
                    className="transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-dim)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Дедлайн этапа</label>
                  <input
                    type="date"
                    value={stage.deadline}
                    onChange={e => setStageField(i, 'deadline', e.target.value)}
                    className="input"
                    style={{ background: 'var(--surface)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Ответственный</label>
                  <select
                    value={stage.assignee_id}
                    onChange={e => setStageField(i, 'assignee_id', e.target.value)}
                    className="input"
                    style={{ background: 'var(--surface)' }}
                  >
                    <option value="">— не назначен —</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name}{emp.position ? ` · ${emp.position}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Кнопки */}
      <div className="flex gap-3 pb-8">
        <a
          href="/dashboard/projects"
          className="flex-1 text-sm font-medium py-3 rounded-xl text-center transition-colors"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}
        >
          Отмена
        </a>
        <button
          type="submit"
          disabled={loading || !form.name.trim()}
          className="flex-2 btn-green disabled:opacity-40 px-10"
        >
          {loading ? 'Создание...' : 'Создать проект'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}
