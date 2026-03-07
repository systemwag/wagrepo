'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = { onClose: () => void }

export default function NewProjectModal({ onClose }: Props) {
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

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: form.name,
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
      await supabase.from('project_stages').insert([
        { project_id: project.id, name: 'К выполнению', order_index: 0 },
        { project_id: project.id, name: 'В работе', order_index: 1 },
        { project_id: project.id, name: 'На проверке', order_index: 2 },
        { project_id: project.id, name: 'Готово', order_index: 3 },
      ])

      router.push(`/dashboard/projects/${project.id}`)
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="card w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Новый проект</h2>
          <button onClick={onClose} className="transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Название *">
            <input
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Например: Административный корпус ТОО «...»"
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Заказчик">
              <input value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Название организации" className="input" />
            </Field>
            <Field label="№ договора">
              <input value={form.contract_number} onChange={e => set('contract_number', e.target.value)} placeholder="ДГ-2025-001" className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Бюджет (₸)">
              <input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="0" className="input" />
            </Field>
            <Field label="Начало">
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" />
            </Field>
            <Field label="Дедлайн">
              <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} className="input" />
            </Field>
          </div>

          <Field label="Описание">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Краткое описание проекта..."
              rows={3}
              className="input resize-none"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm font-medium py-2.5 rounded-xl transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
            >
              Отмена
            </button>
            <button type="submit" disabled={loading} className="flex-1 btn-green">
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
