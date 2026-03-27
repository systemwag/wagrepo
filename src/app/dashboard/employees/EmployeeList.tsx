'use client'

import { useState } from 'react'
import { createEmployee, updateEmployee, deleteEmployee, resetPassword } from './actions'
import {
  Plus, Search, Pencil, Trash2, X, Users, Building2,
  Crown, Briefcase, User, Cake, ChevronDown, ChevronUp, Shield,
  KeyRound, Eye, EyeOff, Check,
} from 'lucide-react'

type Employee = {
  id: string
  full_name: string
  role: string
  position: string | null
  department: string | null
  birth_date: string | null
  is_active: boolean
}

type Modal =
  | { type: 'add' }
  | { type: 'edit'; emp: Employee }
  | { type: 'delete'; emp: Employee }
  | { type: 'password'; emp: Employee }
  | null

const roleLabel: Record<string, string> = {
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}
const roleStyle: Record<string, React.CSSProperties> = {
  director: { background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' },
  manager:  { background: 'rgba(59,130,246,0.12)',  color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' },
  employee: { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' },
}
const roleIcon: Record<string, React.ReactNode> = {
  director: <Crown size={11} />,
  manager:  <Briefcase size={11} />,
  employee: <User size={11} />,
}

function birthdayDaysLeft(birthDate: string): number {
  const today = new Date()
  const bd    = new Date(birthDate)
  const next  = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

function formatBirthDate(birthDate: string) {
  return new Date(birthDate).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'long' })
}

function calcAge(birthDate: string) {
  const today = new Date()
  const bd    = new Date(birthDate)
  let age = today.getFullYear() - bd.getFullYear()
  if (today.getMonth() < bd.getMonth() || (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) age--
  return age
}

export default function EmployeeList({ employees }: { employees: Employee[] }) {
  const [modal, setModal]   = useState<Modal>(null)
  const [search, setSearch] = useState('')
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set())

  const active   = employees.filter(e => e.is_active)
  const inactive = employees.filter(e => !e.is_active)

  const filtered = search.trim()
    ? active.filter(e =>
        e.full_name.toLowerCase().includes(search.toLowerCase()) ||
        e.position?.toLowerCase().includes(search.toLowerCase()) ||
        e.department?.toLowerCase().includes(search.toLowerCase())
      )
    : active

  const directors = filtered.filter(e => e.role === 'director')
  const others    = filtered.filter(e => e.role !== 'director')

  const deptMap = new Map<string, Employee[]>()
  for (const emp of others) {
    const key = emp.department ?? '— Отдел не указан —'
    if (!deptMap.has(key)) deptMap.set(key, [])
    deptMap.get(key)!.push(emp)
  }

  const upcomingBirthdays = active.filter(e => e.birth_date && birthdayDaysLeft(e.birth_date) <= 7)

  function toggleDept(dept: string) {
    setCollapsedDepts(prev => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept); else next.add(dept)
      return next
    })
  }

  return (
    <>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Сотрудники</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{active.length} активных</span>
            {(['director', 'manager', 'employee'] as const).map(r => (
              <span key={r} className="text-xs px-2 py-0.5 rounded-full" style={roleStyle[r]}>
                {active.filter(e => e.role === r).length} {roleLabel[r].toLowerCase()}
              </span>
            ))}
          </div>
        </div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-green flex items-center gap-2">
          <Plus size={16} />
          Добавить сотрудника
        </button>
      </div>

      {/* Ближайшие дни рождения */}
      {upcomingBirthdays.length > 0 && (
        <div className="rounded-2xl px-5 py-4 mb-5 flex items-center gap-3 flex-wrap"
          style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)' }}>
          <Cake size={16} style={{ color: '#ca8a04', flexShrink: 0 }} />
          <span className="text-sm font-medium" style={{ color: '#ca8a04' }}>Дни рождения:</span>
          <div className="flex items-center gap-3 flex-wrap">
            {upcomingBirthdays.map(emp => {
              const days = birthdayDaysLeft(emp.birth_date!)
              return (
                <div key={emp.id} className="flex items-center gap-1.5">
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{emp.full_name.split(' ')[0]}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(234,179,8,0.15)', color: '#ca8a04' }}>
                    {days === 0 ? 'Сегодня!' : days === 1 ? 'Завтра' : `через ${days} дня`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Поиск */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени, должности, отделу..."
          className="input pl-10"
          style={{ background: 'var(--surface)' }}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Руководство */}
      {directors.length > 0 && (
        <div className="mb-5">
          <DeptHeader icon={<Shield size={13} />} label="Руководство" count={directors.length} />
          <div className="space-y-2">
            {directors.map(emp => (
              <EmployeeCard key={emp.id} emp={emp}
                onEdit={() => setModal({ type: 'edit', emp })}
                onDelete={() => setModal({ type: 'delete', emp })}
                onPassword={() => setModal({ type: 'password', emp })} />
            ))}
          </div>
        </div>
      )}

      {/* По отделам */}
      {[...deptMap.entries()].map(([dept, emps]) => {
        const isCollapsed = collapsedDepts.has(dept)
        return (
          <div key={dept} className="mb-5">
            <DeptHeader icon={<Building2 size={13} />} label={dept} count={emps.length}
              collapsed={isCollapsed} onToggle={() => toggleDept(dept)} />
            {!isCollapsed && (
              <div className="space-y-2">
                {emps.map(emp => (
                  <EmployeeCard key={emp.id} emp={emp}
                    onEdit={() => setModal({ type: 'edit', emp })}
                    onDelete={() => setModal({ type: 'delete', emp })}
                    onPassword={() => setModal({ type: 'password', emp })} />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="card py-16 text-center">
          <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
          <p style={{ color: 'var(--text-muted)' }}>{search ? 'Ничего не найдено' : 'Сотрудников пока нет'}</p>
        </div>
      )}

      {/* Неактивные */}
      {inactive.length > 0 && (
        <div className="mt-6">
          <DeptHeader icon={<User size={13} />} label="Неактивные" count={inactive.length} />
          <div className="space-y-2">
            {inactive.map(emp => (
              <div key={emp.id} className="flex items-center gap-4 px-5 py-3.5 rounded-2xl opacity-50"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <AvatarCircle name={emp.full_name} inactive />
                <p className="flex-1 text-sm font-medium line-through" style={{ color: 'var(--text-muted)' }}>{emp.full_name}</p>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ border: '1px solid var(--border-2)', color: 'var(--text-dim)' }}>
                  Неактивен
                </span>
                <IconBtn title="Сбросить пароль" onClick={() => setModal({ type: 'password', emp })}>
                  <KeyRound size={14} />
                </IconBtn>
                <IconBtn title="Редактировать" onClick={() => setModal({ type: 'edit', emp })}>
                  <Pencil size={14} />
                </IconBtn>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal?.type === 'add'      && <AddModal      onClose={() => setModal(null)} />}
      {modal?.type === 'edit'     && <EditModal     emp={modal.emp} onClose={() => setModal(null)} />}
      {modal?.type === 'delete'   && <DeleteModal   emp={modal.emp} onClose={() => setModal(null)} />}
      {modal?.type === 'password' && <PasswordModal emp={modal.emp} onClose={() => setModal(null)} />}
    </>
  )
}

function DeptHeader({ icon, label, count, collapsed, onToggle }: {
  icon: React.ReactNode; label: string; count: number; collapsed?: boolean; onToggle?: () => void
}) {
  return (
    <button onClick={onToggle} disabled={!onToggle}
      className="flex items-center gap-2 mb-2.5 w-full text-left px-1">
      <span style={{ color: 'var(--text-dim)' }}>{icon}</span>
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span className="text-xs px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'var(--surface-2)', color: 'var(--text-dim)' }}>{count}</span>
      {onToggle && <span className="ml-auto" style={{ color: 'var(--text-dim)' }}>{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</span>}
    </button>
  )
}

function EmployeeCard({ emp, onEdit, onDelete, onPassword }: { emp: Employee; onEdit: () => void; onDelete: () => void; onPassword: () => void }) {
  const upcoming = emp.birth_date ? birthdayDaysLeft(emp.birth_date) <= 7 : false
  const age      = emp.birth_date ? calcAge(emp.birth_date) : null

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group"
      style={{ background: 'var(--surface)', border: `1px solid ${upcoming ? 'rgba(234,179,8,0.25)' : 'var(--border)'}` }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = upcoming ? 'rgba(234,179,8,0.45)' : 'var(--border-2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = upcoming ? 'rgba(234,179,8,0.25)' : 'var(--border)'}
    >
      <AvatarCircle name={emp.full_name} role={emp.role} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold" style={{ color: 'var(--text)' }}>{emp.full_name}</span>
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={roleStyle[emp.role]}>
            {roleIcon[emp.role]}{roleLabel[emp.role]}
          </span>
          {upcoming && emp.birth_date && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(234,179,8,0.12)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.2)' }}>
              <Cake size={10} />
              {birthdayDaysLeft(emp.birth_date) === 0 ? 'Сегодня!' : 'Скоро д.р.'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {emp.position && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{emp.position}</span>}
          {emp.position && emp.department && <span style={{ color: 'var(--text-dim)' }}>·</span>}
          {emp.department && (
            <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Building2 size={12} />{emp.department}
            </span>
          )}
          {emp.birth_date && (
            <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
              <Cake size={12} />{formatBirthDate(emp.birth_date)}{age !== null ? `, ${age} лет` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconBtn title="Сбросить пароль" onClick={onPassword}><KeyRound size={14} /></IconBtn>
        <IconBtn title="Редактировать" onClick={onEdit}><Pencil size={14} /></IconBtn>
        <IconBtn title="Удалить" danger onClick={onDelete}><Trash2 size={14} /></IconBtn>
      </div>
    </div>
  )
}

function AvatarCircle({ name, role, inactive }: { name: string; role?: string; inactive?: boolean }) {
  const bg    = { director: 'rgba(139,92,246,0.15)', manager: 'rgba(59,130,246,0.15)', employee: 'var(--green-glow)' }
  const color = { director: '#a78bfa', manager: '#60a5fa', employee: 'var(--green)' }
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold"
      style={{
        background: inactive ? 'var(--surface-2)' : (bg[role as keyof typeof bg] ?? 'var(--surface-2)'),
        color:      inactive ? 'var(--text-dim)'   : (color[role as keyof typeof color] ?? 'var(--text-muted)'),
        border:     !inactive && role ? `2px solid ${color[role as keyof typeof color]}44` : '1px solid var(--border)',
      }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
      style={{ color: 'var(--text-dim)' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = danger ? '#f87171' : 'var(--text)'; el.style.background = danger ? 'rgba(239,68,68,0.08)' : 'var(--surface-2)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-dim)'; el.style.background = 'transparent' }}>
      {children}
    </button>
  )
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {label}{required && <span className="ml-0.5" style={{ color: '#f87171' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function RolePicker({ value, onChange }: { value: string; onChange: (r: string) => void }) {
  return (
    <Field label="Роль">
      <div className="grid grid-cols-3 gap-2">
        {(['employee', 'manager', 'director'] as const).map(r => (
          <button key={r} type="button" onClick={() => onChange(r)}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: value === r ? (roleStyle[r].background as string) : 'transparent',
              color:      value === r ? (roleStyle[r].color as string)       : 'var(--text-dim)',
              border: `1px solid ${value === r ? (roleStyle[r].border as string) : 'var(--border)'}`,
            }}>
            {roleIcon[r]}{roleLabel[r]}
          </button>
        ))}
      </div>
    </Field>
  )
}

/* ── AddModal ── */
function AddModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'employee', position: '', department: '', birth_date: '' })
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const needsDept = form.role !== 'director'

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const res = await createEmployee(form)
    if (res.error) { setError(res.error); setLoading(false) } else onClose()
  }

  return (
    <ModalShell title="Новый сотрудник" subtitle="Создать аккаунт и профиль" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" required>
            <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" placeholder="user@company.kz" />
          </Field>
          <Field label="Пароль" required>
            <PasswordInput value={form.password} onChange={v => set('password', v)} placeholder="Мин. 6 символов" minLength={6} />
          </Field>
        </div>
        <Field label="ФИО" required>
          <input required value={form.full_name} onChange={e => set('full_name', e.target.value)} className="input" placeholder="Иванов Иван Иванович" />
        </Field>
        <RolePicker value={form.role} onChange={v => set('role', v)} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Должность">
            <input value={form.position} onChange={e => set('position', e.target.value)} className="input" placeholder="Инженер-проектировщик" />
          </Field>
          <Field label={needsDept ? 'Отдел' : 'Отдел (н/д для директора)'}>
            <input value={form.department} onChange={e => set('department', e.target.value)} className="input"
              placeholder="Проектный отдел" disabled={!needsDept} style={{ opacity: needsDept ? 1 : 0.4 }} />
          </Field>
        </div>
        <Field label="День рождения">
          <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className="input" />
        </Field>
        {error && <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 text-sm font-medium py-2.5 rounded-xl"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}>Отмена</button>
          <button type="submit" disabled={loading} className="flex-1 btn-green disabled:opacity-40">
            {loading ? 'Создание...' : 'Создать сотрудника'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ── EditModal ── */
function EditModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm] = useState({
    full_name: emp.full_name, role: emp.role, position: emp.position ?? '',
    department: emp.department ?? '', birth_date: emp.birth_date ?? '', is_active: emp.is_active,
  })
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))
  const needsDept = form.role !== 'director'

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const res = await updateEmployee(emp.id, { ...form, position: form.position, department: form.department, birth_date: form.birth_date })
    if (res.error) { setError(res.error); setLoading(false) } else onClose()
  }

  return (
    <ModalShell title="Редактировать сотрудника" subtitle={emp.full_name} onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <Field label="ФИО" required>
          <input required value={form.full_name} onChange={e => set('full_name', e.target.value)} className="input" />
        </Field>
        <RolePicker value={form.role} onChange={v => set('role', v)} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Должность">
            <input value={form.position} onChange={e => set('position', e.target.value)} className="input" placeholder="Инженер-проектировщик" />
          </Field>
          <Field label={needsDept ? 'Отдел' : 'Отдел (н/д для директора)'}>
            <input value={form.department} onChange={e => set('department', e.target.value)} className="input"
              placeholder="Проектный отдел" disabled={!needsDept} style={{ opacity: needsDept ? 1 : 0.4 }} />
          </Field>
        </div>
        <Field label="День рождения">
          <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className="input" />
        </Field>
        <div className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Активный сотрудник</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Неактивные не появляются в списках выбора</p>
          </div>
          <button type="button" onClick={() => set('is_active', !form.is_active)}
            className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors"
            style={{ background: form.is_active ? 'var(--green)' : 'var(--border-2)' }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
              style={{ background: 'white', left: form.is_active ? '22px' : '2px' }} />
          </button>
        </div>
        {error && <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 text-sm font-medium py-2.5 rounded-xl"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}>Отмена</button>
          <button type="submit" disabled={loading} className="flex-1 btn-green disabled:opacity-40">
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ── PasswordInput — поле с глазом ── */
function PasswordInput({ value, onChange, placeholder, minLength }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minLength?: number
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        minLength={minLength}
        className="input w-full"
        style={{ paddingRight: '44px' }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors"
        style={{ color: show ? 'var(--text)' : 'var(--text-dim)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        title={show ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

/* ── PasswordModal ── */
function PasswordModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6)        { setError('Пароль должен быть не менее 6 символов'); return }
    if (password !== confirm)        { setError('Пароли не совпадают'); return }
    setLoading(true); setError('')
    const res = await resetPassword(emp.id, password)
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setSuccess(true)
    setTimeout(onClose, 1500)
  }

  return (
    <ModalShell title="Сброс пароля" subtitle={emp.full_name} onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <KeyRound size={16} style={{ color: '#a78bfa', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Новый пароль будет установлен немедленно. Сотрудник сможет войти с ним при следующем входе.
          </p>
        </div>

        <Field label="Новый пароль" required>
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Минимум 6 символов"
            minLength={6}
          />
        </Field>

        <Field label="Повторите пароль" required>
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            placeholder="Введите пароль ещё раз"
          />
        </Field>

        {/* Индикатор совпадения */}
        {confirm.length > 0 && (
          <div className="flex items-center gap-2 text-xs"
            style={{ color: password === confirm ? 'var(--green)' : '#f87171' }}>
            {password === confirm
              ? <><Check size={13} /> Пароли совпадают</>
              : <><X size={13} /> Пароли не совпадают</>}
          </div>
        )}

        {error && (
          <p className="text-sm px-3 py-2 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</p>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: 'var(--green)' }}>
            <Check size={14} /> Пароль успешно изменён
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 text-sm font-medium py-2.5 rounded-xl"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}>
            Отмена
          </button>
          <button type="submit" disabled={loading || success} className="flex-1 btn-green disabled:opacity-40">
            {loading ? 'Сохранение...' : 'Установить пароль'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ── DeleteModal ── */
function DeleteModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function confirm() {
    setLoading(true); setError('')
    const res = await deleteEmployee(emp.id)
    if (res.error) { setError(res.error); setLoading(false) } else onClose()
  }

  return (
    <ModalShell title="Удалить сотрудника" onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <AvatarCircle name={emp.full_name} role={emp.role} />
          <div>
            <p className="font-medium" style={{ color: 'var(--text)' }}>{emp.full_name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{roleLabel[emp.role]}{emp.department ? ` · ${emp.department}` : ''}</p>
          </div>
        </div>
        <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>Вы уверены, что хотите удалить этого сотрудника?</p>
        <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Это действие необратимо.</p>
        {error && <p className="text-sm mb-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 text-sm font-medium py-2.5 rounded-xl"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}>Отмена</button>
          <button onClick={confirm} disabled={loading}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.22)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'}>
            {loading ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
