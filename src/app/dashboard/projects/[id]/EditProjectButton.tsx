'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Pencil, X, Loader2,
  FileText, Building2, CalendarDays, CalendarCheck,
  UserCog, AlignLeft, Check,
} from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import DatePicker from '@/components/ui/DatePicker'
import ManagerPicker, { type Employee } from '@/components/projects/ManagerPicker'
import { useToast } from '@/components/ui/Toast'
import { updateProject } from '@/lib/actions/projects'

type Props = {
  projectId: string
  currentUserId: string
  initial: {
    name: string
    client_name: string | null
    contract_number: string | null
    start_date: string | null
    deadline: string | null
    description: string | null
    manager_id: string | null
  }
  employees: Employee[]
}

export default function EditProjectButton({ projectId, currentUserId, initial, employees }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = useTransition()

  // Локальный state формы пересоздаём при каждом открытии — чтобы свежие
  // initial-значения подтянулись после router.refresh().
  const [form, setForm] = useState(() => toForm(initial))

  function openModal() {
    setForm(toForm(initial))
    setOpen(true)
  }

  function close() {
    if (pending) return
    setOpen(false)
  }

  function setField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    startTransition(async () => {
      const res = await updateProject({
        id:              projectId,
        name:            form.name.trim(),
        client_name:     form.client_name.trim() || undefined,
        contract_number: form.contract_number.trim() || undefined,
        start_date:      form.start_date || null,
        deadline:        form.deadline || null,
        description:     form.description.trim() || undefined,
        manager_id:      form.manager_id || currentUserId,
      })
      if (res.error) {
        toast.show('error', res.error)
        return
      }
      toast.show('success', 'Проект обновлён')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl transition-colors hover-green hover-border"
        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
      >
        <Pencil size={14} />
        Редактировать
      </button>

      {open && (
        <Portal>
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'color-mix(in oklab, #000 70%, transparent)', backdropFilter: 'blur(4px)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) close() }}
          >
            <form
              onSubmit={handleSubmit}
              onMouseDown={e => e.stopPropagation()}
              className="card w-full max-w-xl max-h-[90vh] flex flex-col"
            >
              <div
                className="flex items-center justify-between px-6 py-4 shrink-0"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <Pencil size={18} style={{ color: 'var(--green)' }} />
                  <h2 className="font-semibold text-base text-text">Редактирование проекта</h2>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-text-muted hover-surface"
                  aria-label="Закрыть"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <Field label="Менеджер проекта" icon={<UserCog className="w-3.5 h-3.5" />}>
                  <ManagerPicker
                    employees={employees}
                    value={form.manager_id}
                    onChange={id => setField('manager_id', id)}
                    currentUserId={currentUserId}
                  />
                </Field>

                <Field label="Описание" icon={<AlignLeft className="w-3.5 h-3.5" />}>
                  <textarea
                    value={form.description}
                    onChange={e => setField('description', e.target.value)}
                    placeholder="Краткое описание, цели и особенности проекта..."
                    rows={4}
                    className="input resize-none"
                  />
                </Field>
              </div>

              <div
                className="flex gap-3 px-6 py-4 shrink-0"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="flex-1 text-sm font-medium py-2.5 rounded-xl disabled:opacity-40"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={pending || !form.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 btn-green disabled:opacity-40 text-sm font-semibold py-2.5"
                >
                  {pending ? (
                    <><Loader2 size={14} className="animate-spin" />Сохраняем...</>
                  ) : (
                    <><Check size={14} />Сохранить</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </Portal>
      )}
    </>
  )
}

function toForm(p: Props['initial']) {
  return {
    name:            p.name ?? '',
    client_name:     p.client_name ?? '',
    contract_number: p.contract_number ?? '',
    start_date:      p.start_date ?? '',
    deadline:        p.deadline ?? '',
    description:     p.description ?? '',
    manager_id:      p.manager_id ?? '',
  }
}

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
