'use client'

import { useState } from 'react'
import { createEmployee, updateEmployee, deleteEmployee } from './actions'

type Employee = {
  id: string
  full_name: string
  role: string
  position: string | null
  department: string | null
  is_active: boolean
}

const roleLabel: Record<string, string> = {
  director: 'Директор',
  manager: 'Менеджер',
  employee: 'Сотрудник',
}

const roleStyle: Record<string, React.CSSProperties> = {
  director: { background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' },
  manager:  { background: 'rgba(59,130,246,0.12)',  color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' },
  employee: { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' },
}

type Modal =
  | { type: 'add' }
  | { type: 'edit'; emp: Employee }
  | { type: 'delete'; emp: Employee }
  | null

export default function EmployeeList({ employees, canManage }: { employees: Employee[]; canManage: boolean }) {
  const [modal, setModal] = useState<Modal>(null)
  const active   = employees.filter(e => e.is_active)
  const inactive = employees.filter(e => !e.is_active)

  return (
    <>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Сотрудники</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{active.length} активных</p>
        </div>
        {canManage && (
          <button onClick={() => setModal({ type: 'add' })} className="btn-green flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Добавить сотрудника
          </button>
        )}
      </div>

      {/* Активные */}
      <div className="card">
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-medium" style={{ color: 'var(--text)' }}>Команда</h2>
        </div>
        {active.length > 0 ? (
          <div>
            {active.map((emp, i) => (
              <div key={emp.id} className="px-6 py-4 flex items-center gap-4"
                style={{ borderBottom: i < active.length - 1 ? '1px solid var(--border)' : undefined }}>
                <Avatar name={emp.full_name} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ color: 'var(--text)' }}>{emp.full_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {emp.position && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{emp.position}</span>}
                    {emp.position && emp.department && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>·</span>}
                    {emp.department && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{emp.department}</span>}
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={roleStyle[emp.role]}>
                  {roleLabel[emp.role]}
                </span>
                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <IconBtn title="Редактировать" onClick={() => setModal({ type: 'edit', emp })}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </IconBtn>
                    <IconBtn title="Удалить" danger onClick={() => setModal({ type: 'delete', emp })}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </IconBtn>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Сотрудников пока нет</div>
        )}
      </div>

      {/* Неактивные */}
      {inactive.length > 0 && (
        <div className="card mt-4">
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-medium" style={{ color: 'var(--text-muted)' }}>Неактивные</h2>
          </div>
          <div>
            {inactive.map((emp, i) => (
              <div key={emp.id} className="px-6 py-4 flex items-center gap-4 opacity-60"
                style={{ borderBottom: i < inactive.length - 1 ? '1px solid var(--border)' : undefined }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--surface-2)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{emp.full_name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ color: 'var(--text-muted)' }}>{emp.full_name}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ border: '1px solid var(--border-2)', color: 'var(--text-dim)' }}>
                  Неактивен
                </span>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <IconBtn title="Редактировать" onClick={() => setModal({ type: 'edit', emp })}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </IconBtn>
                    <IconBtn title="Удалить" danger onClick={() => setModal({ type: 'delete', emp })}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </IconBtn>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модалки */}
      {modal?.type === 'add'    && <AddModal    onClose={() => setModal(null)} />}
      {modal?.type === 'edit'   && <EditModal   emp={modal.emp} onClose={() => setModal(null)} />}
      {modal?.type === 'delete' && <DeleteModal emp={modal.emp} onClose={() => setModal(null)} />}
    </>
  )
}

/* ── Вспомогательные компоненты ── */

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: 'var(--green-glow)', border: '1px solid rgba(34,197,94,0.3)' }}>
      <span className="font-medium" style={{ color: 'var(--green)' }}>{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
      style={{ color: 'var(--text-dim)' }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.color = danger ? '#f87171' : 'var(--text)'
        el.style.background = danger ? 'rgba(239,68,68,0.08)' : 'var(--surface-2)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.color = 'var(--text-dim)'
        el.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} className="transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
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

/* ── Добавить сотрудника ── */
function AddModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'employee', position: '', department: '' })
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await createEmployee(form)
    if (res.error) { setError(res.error); setLoading(false) }
    else onClose()
  }

  return (
    <ModalShell title="Новый сотрудник" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email *">
            <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" placeholder="user@company.kz" />
          </Field>
          <Field label="Пароль *">
            <input required type="password" value={form.password} onChange={e => set('password', e.target.value)} className="input" placeholder="Минимум 6 символов" minLength={6} />
          </Field>
        </div>
        <Field label="ФИО *">
          <input required value={form.full_name} onChange={e => set('full_name', e.target.value)} className="input" placeholder="Иванов Иван Иванович" />
        </Field>
        <Field label="Роль">
          <select value={form.role} onChange={e => set('role', e.target.value)} className="input">
            <option value="employee">Сотрудник</option>
            <option value="manager">Менеджер</option>
            <option value="director">Директор</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Должность">
            <input value={form.position} onChange={e => set('position', e.target.value)} className="input" placeholder="Инженер" />
          </Field>
          <Field label="Отдел">
            <input value={form.department} onChange={e => set('department', e.target.value)} className="input" placeholder="Проектный" />
          </Field>
        </div>
        {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 text-sm font-medium py-2.5 rounded-xl transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}>
            Отмена
          </button>
          <button type="submit" disabled={loading} className="flex-1 btn-green disabled:opacity-40">
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ── Редактировать сотрудника ── */
function EditModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: emp.full_name,
    role: emp.role,
    position: emp.position ?? '',
    department: emp.department ?? '',
    is_active: emp.is_active,
  })
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await updateEmployee(emp.id, { ...form, position: form.position, department: form.department })
    if (res.error) { setError(res.error); setLoading(false) }
    else onClose()
  }

  return (
    <ModalShell title="Редактировать сотрудника" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <Field label="ФИО *">
          <input required value={form.full_name} onChange={e => set('full_name', e.target.value)} className="input" />
        </Field>
        <Field label="Роль">
          <select value={form.role} onChange={e => set('role', e.target.value)} className="input">
            <option value="employee">Сотрудник</option>
            <option value="manager">Менеджер</option>
            <option value="director">Директор</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Должность">
            <input value={form.position} onChange={e => set('position', e.target.value)} className="input" placeholder="Инженер" />
          </Field>
          <Field label="Отдел">
            <input value={form.department} onChange={e => set('department', e.target.value)} className="input" placeholder="Проектный" />
          </Field>
        </div>

        {/* Статус активности */}
        <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Активный сотрудник</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Неактивные не видны в списках выбора</p>
          </div>
          <button type="button" onClick={() => set('is_active', !form.is_active)}
            className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors"
            style={{ background: form.is_active ? 'var(--green)' : 'var(--border-2)' }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
              style={{ background: 'white', left: form.is_active ? '22px' : '2px' }} />
          </button>
        </div>

        {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 text-sm font-medium py-2.5 rounded-xl"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}>
            Отмена
          </button>
          <button type="submit" disabled={loading} className="flex-1 btn-green disabled:opacity-40">
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ── Удалить сотрудника ── */
function DeleteModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setLoading(true); setError('')
    const res = await deleteEmployee(emp.id)
    if (res.error) { setError(res.error); setLoading(false) }
    else onClose()
  }

  return (
    <ModalShell title="Удалить сотрудника" onClose={onClose}>
      <div className="p-6">
        <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>
          Вы уверены, что хотите удалить <strong>{emp.full_name}</strong>?
        </p>
        <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
          Это действие необратимо. Аккаунт и все связанные данные будут удалены.
        </p>
        {error && <p className="text-sm mb-3" style={{ color: '#f87171' }}>{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 text-sm font-medium py-2.5 rounded-xl"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}>
            Отмена
          </button>
          <button onClick={confirm} disabled={loading}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.25)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'}
          >
            {loading ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
