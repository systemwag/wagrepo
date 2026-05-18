'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ClipboardList, Loader2, Plus, User, X } from 'lucide-react'
import type { ChecklistItem, DesignStage } from '@/lib/constants/design-stages'
import {
  addChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from '@/lib/actions/checklist'
import SectionBlock from './SectionBlock'

type TaskRef = { id: string; title: string; checklist_item_id: string | null }

export default function ChecklistPanel({
  stage,
  projectId,
  canManage,
  tasks,
  currentUserId,
}: {
  stage: DesignStage
  projectId: string
  canManage: boolean
  tasks: TaskRef[]
  currentUserId?: string
}) {
  const router = useRouter()
  const [items, setItems] = useState<ChecklistItem[]>(stage.checklist_items)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Подхватываем свежие пункты от RSC (router.refresh() или realtime).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setItems(stage.checklist_items) }, [stage.checklist_items])

  const doneCount = items.filter(i => i.is_completed).length

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  async function handleAdd() {
    if (!newLabel.trim()) return
    setSaving(true)
    const result = await addChecklistItem(stage.id, newLabel.trim(), projectId)
    if (!result.error && result.item) {
      setItems(prev => [...prev, result.item as ChecklistItem])
      router.refresh()
    }
    setNewLabel('')
    setAdding(false)
    setSaving(false)
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    deleteChecklistItem(id, projectId).then(() => router.refresh())
  }

  return (
    <SectionBlock
      icon={<ClipboardList size={13} />}
      title="Чек-лист"
      count={items.length > 0 ? `${doneCount}/${items.length}` : undefined}
    >
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {items.length > 0 && (
          <div>
            {items.map((item, i) => {
              const linkedTasks = tasks.filter(t => t.checklist_item_id === item.id)
              return (
                <div key={item.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <ChecklistRow
                    item={item}
                    projectId={projectId}
                    canManage={canManage}
                    currentUserId={currentUserId}
                    linkedTasks={linkedTasks}
                    onDelete={() => handleDelete(item.id)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {items.length === 0 && !adding && (
          <div className="flex items-center justify-center gap-2 py-4"
            style={{ color: 'var(--text-dim)' }}>
            <ClipboardList size={13} />
            <span className="text-sm">Чек-лист пуст</span>
          </div>
        )}

        {adding && (
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: items.length > 0 ? '1px solid var(--border)' : 'none' }}>
            <div className="w-6 h-6 rounded-md flex-shrink-0" style={{ border: '2px solid var(--border-2)' }} />
            <input
              ref={inputRef}
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Название пункта..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text)' }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
                if (e.key === 'Escape') { setAdding(false); setNewLabel('') }
              }}
            />
            <button
              onClick={handleAdd}
              disabled={saving || !newLabel.trim()}
              className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-40"
              style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : 'Добавить'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setNewLabel('') }}
              aria-label="Отменить добавление пункта"
              className="p-1 rounded-lg row-icon-btn"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {canManage && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2.5 add-item-btn"
            style={{
              borderTop: items.length > 0 ? '1px solid var(--border)' : 'none',
            }}
          >
            <Plus size={14} />
            Добавить пункт
          </button>
        )}
      </div>
    </SectionBlock>
  )
}

function ChecklistRow({
  item,
  projectId,
  canManage,
  currentUserId,
  linkedTasks,
  onDelete,
}: {
  item: ChecklistItem
  projectId: string
  canManage: boolean
  currentUserId?: string
  linkedTasks: TaskRef[]
  onDelete: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [optimisticDone, setOptimisticDone] = useState(item.is_completed)
  // Если пункт отмечен другим пользователем — клик показывает inline-подтверждение
  // вместо мгновенного снятия. Свою отметку снимаем без вопросов.
  const [confirmUncheck, setConfirmUncheck] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOptimisticDone(item.is_completed) }, [item.is_completed])

  // completed_by по типу — string | null. Проверка foreign (не моя ли отметка).
  const checkedByOther = optimisticDone
    && item.completed_by != null
    && currentUserId != null
    && item.completed_by !== currentUserId

  function doToggle(next: boolean) {
    setOptimisticDone(next)
    startTransition(async () => {
      const result = await toggleChecklistItem(item.id, next, projectId)
      if (result.error) setOptimisticDone(!next)
      else router.refresh()
    })
  }

  function handleToggle() {
    if (confirmUncheck) return // пока открыт confirm, клики игнорируем
    // Снять чужую отметку — через подтверждение, чтобы случайный тап не стёр.
    if (optimisticDone && checkedByOther) {
      setConfirmUncheck(true)
      return
    }
    doToggle(!optimisticDone)
  }

  function handleConfirmUncheck() {
    setConfirmUncheck(false)
    doToggle(false)
  }

  function handleCancelUncheck() {
    setConfirmUncheck(false)
  }

  const checkerName = item.checker?.full_name ?? null

  return (
    <div className="checklist-row group transition-colors">
    <div className="flex items-start gap-3 px-3 py-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        role="checkbox"
        aria-checked={optimisticDone}
        aria-label={
          optimisticDone
            ? checkedByOther
              ? `Снять отметку, поставленную ${checkerName ?? 'другим пользователем'}: ${item.label}`
              : `Снять отметку: ${item.label}`
            : `Отметить выполненным: ${item.label}`
        }
        className="flex items-start gap-3 flex-1 text-left min-w-0 disabled:opacity-60"
      >
        <div
          className="flex-shrink-0"
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: optimisticDone ? 'var(--green)' : 'transparent',
            border: `2px solid ${optimisticDone ? 'var(--green)' : 'var(--border-2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {optimisticDone && <Check size={14} color="#040d07" strokeWidth={3} />}
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="text-sm"
            style={{
              color: optimisticDone ? 'var(--text-dim)' : 'var(--text-muted)',
              textDecoration: optimisticDone ? 'line-through' : 'none',
            }}
          >
            {item.label}
            {item.is_required && !optimisticDone && (
              <span className="ml-1 text-xs" style={{ color: '#f87171' }}>*</span>
            )}
          </span>
          {optimisticDone && item.checker && item.completed_at && (
            <div className="flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-dim)' }}>
              <User size={10} />
              <span className="text-xs">{item.checker.full_name}</span>
              <span className="text-xs opacity-60">·</span>
              <span className="text-xs">{new Date(item.completed_at).toLocaleString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
          {linkedTasks.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {linkedTasks.map(t => (
                <span key={t.id} className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <ClipboardList size={9} />
                  {t.title.length > 28 ? t.title.slice(0, 28) + '…' : t.title}
                </span>
              ))}
            </div>
          )}
        </div>
        {pending && <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: 'var(--text-dim)' }} />}
      </button>

      {canManage && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Удалить пункт: ${item.label}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded-lg row-icon-danger"
        >
          <X size={13} />
        </button>
      )}
    </div>

    {/* Inline-подтверждение: пункт отмечен ДРУГИМ пользователем, и кто-то
        тапнул чекбокс. Чтобы случайный клик не стёр чужую работу — спрашиваем. */}
    {confirmUncheck && (
      <div
        className="flex items-start gap-2 px-3 pb-2 -mt-1"
      >
        <div
          className="flex-1 px-3 py-2 rounded-lg text-xs flex items-start gap-2"
          style={{
            background: 'color-mix(in oklab, var(--color-warn) 8%, transparent)',
            border: '1px solid color-mix(in oklab, var(--color-warn) 25%, transparent)',
            color: 'var(--color-text-muted)',
          }}
        >
          <span className="flex-1">
            Отметку поставил <b style={{ color: 'var(--color-text)' }}>{checkerName ?? '—'}</b>
            {item.completed_at && (
              <>
                {' '}·{' '}
                <span className="num">
                  {new Date(item.completed_at).toLocaleString('ru-RU', {
                    timeZone: 'Asia/Oral',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </>
            )}
            . Снять отметку?
          </span>
          <button
            type="button"
            onClick={handleConfirmUncheck}
            className="text-xs font-medium px-2.5 py-1 rounded-md flex-shrink-0"
            style={{
              background: 'var(--color-warn)',
              color: '#1a1206',
            }}
          >
            Снять
          </button>
          <button
            type="button"
            onClick={handleCancelUncheck}
            className="text-xs px-2 py-1 rounded-md flex-shrink-0"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Отмена
          </button>
        </div>
      </div>
    )}
    </div>
  )
}
