'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check as CheckIcon, ClipboardList, Link2, Plus, User, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { setProjectTaskAssignees } from '@/lib/actions/assignees'
import { Portal } from '@/components/ui/Portal'
import { PRIORITY_CONFIG, sortEmployeesByRole, type Employee, type Stage } from './_shared'
import { getFirstName } from '@/lib/utils/name'

const ROLE_LABEL: Record<string, string> = {
  admin:    'Admin',
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}

interface Props {
  stage: Stage
  stageColor: string
  stageIndex: number
  employees: Employee[]
  projectId: string
  onClose: () => void
  /** Вызывается ПОСЛЕ успешного создания — внешний код должен закрыть sheet и refresh-нуть данные. */
  onCreated: () => void
}

export default function CreateTaskSheet({
  stage,
  stageColor,
  stageIndex,
  employees,
  projectId,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<string>('medium')
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(() => new Set())
  const [linkedItem, setLinkedItem] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checklistItems = stage.checklist_items ?? []
  const num = String(stageIndex + 1).padStart(2, '0')

  // Сотрудники, сгруппированные по ролям (director → manager → employee)
  const employeesByRole = useMemo(() => {
    const sorted = sortEmployeesByRole(employees)
    const groups = new Map<string, Employee[]>()
    for (const emp of sorted) {
      const role = (emp.role ?? 'employee') as string
      const arr = groups.get(role) ?? []
      arr.push(emp)
      groups.set(role, arr)
    }
    return ['admin', 'director', 'manager', 'employee']
      .filter(r => groups.has(r))
      .map(r => ({ role: r, items: groups.get(r)! }))
  }, [employees])

  function toggleAssignee(id: string) {
    setAssigneeIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Закрытие по Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit() {
    if (!title.trim() || creating) return
    setCreating(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Не авторизован')
      setCreating(false)
      return
    }

    const { data: task, error: insertError } = await supabase
      .from('project_tasks')
      .insert({
        project_id: projectId,
        stage_id: stage.id,
        title: title.trim(),
        created_by: user.id,
        priority,
        ...(linkedItem ? { checklist_item_id: linkedItem } : {}),
      })
      .select('id')
      .single()

    if (insertError || !task) {
      setError(insertError?.message ?? 'Не удалось создать задачу')
      setCreating(false)
      return
    }

    // Назначаем исполнителей через junction (это также шлёт уведомления)
    if (assigneeIds.size > 0) {
      await setProjectTaskAssignees(task.id as string, [...assigneeIds], projectId)
    }

    setCreating(false)
    onCreated()
  }

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100]"
        style={{ background: 'color-mix(in oklab, black 60%, transparent)' }}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        className="fixed z-[101] flex flex-col
                   left-0 right-0 bottom-0 max-h-[88vh] rounded-t-2xl
                   sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                   sm:w-[540px] sm:max-h-[82vh] sm:rounded-2xl
                   animate-fade-up"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header с цветом этапа */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: stageColor + '22',
              color: stageColor,
              border: `1.5px solid ${stageColor}44`,
            }}
          >
            <Plus size={20} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider" style={{ color: stageColor + 'aa' }}>
              Этап {num}
            </p>
            <h3 className="text-base font-semibold truncate" style={{ color: 'var(--text)' }}>
              Новая задача · {stage.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-2 -m-2 rounded-lg hover-surface"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — скроллится */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Название */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-dim)' }}>
              Название задачи
            </label>
            <textarea
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Что нужно сделать"
              rows={2}
              className="input w-full resize-none text-base"
              style={{ fontWeight: 500 }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
          </div>

          {/* Приоритет */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle size={13} style={{ color: 'var(--text-dim)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>Приоритет</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITY_CONFIG.map(p => {
                const active = priority === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className="text-sm py-2 rounded-xl font-medium transition-all"
                    style={{
                      background: active ? p.bg : 'transparent',
                      color: active ? p.color : 'var(--text-dim)',
                      border: `1px solid ${active ? p.border : 'var(--border)'}`,
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Исполнители — несколько; сгруппированы по ролям */}
          {employees.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <User size={13} style={{ color: 'var(--text-dim)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
                  Исполнители {assigneeIds.size > 0 && <span className="num">({assigneeIds.size})</span>}
                </span>
                {assigneeIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setAssigneeIds(new Set())}
                    className="ml-auto text-xs"
                    style={{ color: '#f87171' }}
                  >
                    сбросить
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {employeesByRole.map(({ role, items }) => (
                  <div key={role}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-text-dim">
                      {ROLE_LABEL[role] ?? role}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {items.map(emp => {
                        const selected = assigneeIds.has(emp.id)
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => toggleAssignee(emp.id)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm"
                            style={{
                              background: selected ? 'var(--green-glow)' : 'var(--surface-2)',
                              border: `1px solid ${selected ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                              color: selected ? 'var(--green)' : 'var(--text)',
                            }}
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                              style={{
                                background: selected ? 'rgba(34,197,94,0.25)' : 'var(--border-2)',
                                color: selected ? 'var(--green)' : 'var(--text-muted)',
                              }}
                            >
                              {emp.full_name.charAt(0)}
                            </div>
                            <span>{getFirstName(emp.full_name)}</span>
                            {selected && <CheckIcon size={13} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Связать с пунктом чеклиста */}
          {checklistItems.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Link2 size={13} style={{ color: 'var(--text-dim)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>Связать с пунктом чек-листа</span>
                {linkedItem && (
                  <button type="button" onClick={() => setLinkedItem('')} className="ml-auto text-xs" style={{ color: '#f87171' }}>
                    сбросить
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {checklistItems.map(item => {
                  const linked = linkedItem === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLinkedItem(linked ? '' : item.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all text-sm"
                      style={{
                        background: linked ? 'var(--green-glow)' : 'var(--surface-2)',
                        border: `1px solid ${linked ? 'rgba(34,197,94,0.35)' : 'var(--border)'}`,
                        color: linked ? 'var(--green)' : item.is_completed ? 'var(--text-dim)' : 'var(--text)',
                        textDecoration: item.is_completed ? 'line-through' : 'none',
                      }}
                    >
                      <ClipboardList size={12} style={{ flexShrink: 0 }} />
                      <span>{item.label}</span>
                      {item.is_completed && <span style={{ color: 'var(--green)' }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm px-3 py-2 rounded-xl" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex gap-2 px-5 py-3 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2.5 rounded-xl transition-colors"
            style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={creating || !title.trim()}
            className="flex-1 btn-green text-sm disabled:opacity-40"
            style={{ padding: '10px 16px' }}
          >
            {creating ? 'Создание…' : 'Создать задачу'}
          </button>
        </div>
      </div>
    </Portal>
  )
}
