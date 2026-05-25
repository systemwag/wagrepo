'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  AlertCircle, Check, ClipboardList, Clock, Loader2, Pencil, Play,
  Plus, X,
} from 'lucide-react'
import type { ChecklistItem, DesignStage } from '@/lib/constants/design-stages'
import {
  acceptChecklistItem,
  addChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
  updateChecklistItem,
} from '@/lib/actions/checklist'
import SectionBlock from './SectionBlock'
import ChecklistAssigneesControl from './ChecklistAssigneesControl'
import ChecklistDeadlineChip from './ChecklistDeadlineChip'
import ChecklistStatusBadge, { type ChecklistVisualState } from './ChecklistStatusBadge'
import type { PickerEmployee } from './EmployeePickerPanel'

type TaskRef = { id: string; title: string; checklist_item_id: string | null; status?: string | null }

const TASK_STATUS_DOT: Record<string, { color: string; label: string }> = {
  todo:        { color: 'var(--color-text-muted)', label: 'не принято' },
  in_progress: { color: 'var(--color-info)',       label: 'в работе' },
  review:      { color: 'var(--color-warn)',       label: 'на проверке' },
  done:        { color: 'var(--color-green)',      label: 'выполнено' },
  failed:      { color: 'var(--color-danger)',     label: 'не завершено' },
}

export default function ChecklistPanel({
  stage,
  projectId,
  canManage,
  tasks,
  currentUserId,
  employees,
}: {
  stage: DesignStage
  projectId: string
  canManage: boolean
  tasks: TaskRef[]
  currentUserId?: string
  employees: PickerEmployee[]
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
      <div className="flex flex-col gap-2">
        {items.length > 0 && items.map(item => {
          const linkedTasks = tasks.filter(t => t.checklist_item_id === item.id)
          return (
            <ChecklistRow
              key={item.id}
              item={item}
              projectId={projectId}
              canManage={canManage}
              currentUserId={currentUserId}
              linkedTasks={linkedTasks}
              employees={employees}
              onDelete={() => handleDelete(item.id)}
            />
          )
        })}

        {items.length === 0 && !adding && (
          <div
            className="flex items-center justify-center gap-2 py-6 rounded-xl"
            style={{ color: 'var(--text-dim)', border: '1px dashed var(--color-border-2)' }}
          >
            <ClipboardList size={13} />
            <span className="text-sm">Чек-лист пуст</span>
          </div>
        )}

        {adding && (
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ border: '1px solid color-mix(in oklab, var(--color-green) 30%, transparent)', background: 'var(--color-surface-2)' }}
          >
            <div className="w-5 h-5 rounded-md flex-shrink-0" style={{ border: '2px solid var(--border-2)' }} />
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
            className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2.5 add-item-btn rounded-xl"
            style={{ border: '1px dashed var(--color-border-2)' }}
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
  employees,
  onDelete,
}: {
  item: ChecklistItem
  projectId: string
  canManage: boolean
  currentUserId?: string
  linkedTasks: TaskRef[]
  employees: PickerEmployee[]
  onDelete: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [optimisticDone, setOptimisticDone] = useState(item.is_completed)
  const [optimisticStarted, setOptimisticStarted] = useState<string | null>(item.started_at ?? null)
  // Если пункт отмечен другим пользователем — клик показывает inline-подтверждение
  // вместо мгновенного снятия. Свою отметку снимаем без вопросов.
  const [confirmUncheck, setConfirmUncheck] = useState(false)

  // ── Визуальное состояние пункта (производное от 5 полей):
  //    pending     → нет ассигни
  //    assigned    → есть ассигни, started_at NULL, дедлайн в норме
  //    in_progress → started_at != NULL, не completed, дедлайн в норме
  //    overdue     → assigned/in_progress + дедлайн прошёл (приоритет над in_progress)
  //    completed   → is_completed = true
  // overdue важнее всего — менеджер хочет видеть «горящие пункты» сразу.
  const hasAssignees  = (item.assignees?.length ?? 0) > 0
  const isOverdueLive = !optimisticDone && !!item.deadline && isPastOral(item.deadline)
  const state: ChecklistVisualState =
    optimisticDone     ? 'completed'
    : isOverdueLive    ? 'overdue'
    : optimisticStarted ? 'in_progress'
    : hasAssignees      ? 'assigned'
    : 'pending'

  // Я могу нажать «Взять в работу», если я в ассигнах И пункт не в работе И не сдан.
  const isMyAssignee = !!currentUserId && (item.assignees?.some(a => a.id === currentUserId) ?? false)
  const canAccept = !optimisticDone && !optimisticStarted && isMyAssignee

  // Inline-редактирование label.
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(item.label)
  const editInputRef = useRef<HTMLInputElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOptimisticDone(item.is_completed) }, [item.is_completed])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOptimisticStarted(item.started_at ?? null) }, [item.started_at])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setEditValue(item.label) }, [item.label])

  useEffect(() => {
    if (editing) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [editing])

  function handleSaveEdit() {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === item.label) {
      setEditing(false)
      setEditValue(item.label)
      return
    }
    setEditing(false)
    startTransition(async () => {
      const result = await updateChecklistItem(item.id, trimmed, projectId)
      if (result.error) setEditValue(item.label)
      else router.refresh()
    })
  }

  function handleCancelEdit() {
    setEditing(false)
    setEditValue(item.label)
  }

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

  function handleAccept(e: React.MouseEvent) {
    e.stopPropagation()
    if (optimisticStarted || optimisticDone) return
    const nowIso = new Date().toISOString()
    setOptimisticStarted(nowIso)
    startTransition(async () => {
      const result = await acceptChecklistItem({ itemId: item.id, projectId })
      if (result.error) setOptimisticStarted(item.started_at ?? null)
      else router.refresh()
    })
  }

  const checkerName = item.checker?.full_name ?? null

  // Клавиатурный handler для div-as-button (роль "checkbox").
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (editing || pending) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      handleToggle()
    }
  }

  return (
    <div
      className="checklist-card group"
      data-done={optimisticDone ? 'true' : 'false'}
      data-state={state}
      data-required={item.is_required && !optimisticDone ? 'true' : 'false'}
      role={editing ? undefined : 'checkbox'}
      aria-checked={editing ? undefined : optimisticDone}
      tabIndex={editing || pending ? -1 : 0}
      aria-label={
        optimisticDone
          ? checkedByOther
            ? `Снять отметку, поставленную ${checkerName ?? 'другим пользователем'}: ${item.label}`
            : `Снять отметку: ${item.label}`
          : `Отметить выполненным: ${item.label}`
      }
      onClick={(e) => {
        // Клик по внутренней интерактиве (edit/delete/чип задачи) не должен
        // переключать выполнение — там стоят свои stopPropagation.
        if (editing || pending) return
        const target = e.target as HTMLElement
        // Якорные элементы внутри (Link на задачу) обрабатываются stopPropagation
        // в LinkedTasksRow; здесь страховка на случай новых интерактивов.
        if (target.closest('[data-no-toggle="true"]')) return
        handleToggle()
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="checklist-card-inner">
        {/* ── Верх карточки: индикатор + label/badge + edit/delete ─────── */}
        <div className="checklist-card-head">
          {/* Индикатор слева. Цветовая дифференциация — в CSS через [data-state]. */}
          <span className="checklist-indicator" aria-hidden>
            {state === 'completed'
              ? <Check size={12} strokeWidth={3} />
              : state === 'in_progress' || state === 'overdue'
                ? <Clock size={11} strokeWidth={2.5} />
                : null}
          </span>

          {/* Контент label */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                ref={editInputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation()
                  if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit() }
                  if (e.key === 'Escape') { e.preventDefault(); handleCancelEdit() }
                }}
                onBlur={handleSaveEdit}
                className="w-full bg-transparent text-sm outline-none border-b"
                style={{ color: 'var(--color-text)', borderColor: 'var(--color-green)' }}
                aria-label="Редактировать пункт"
                data-no-toggle="true"
              />
            ) : (
              <span className="checklist-label flex items-center gap-2 flex-wrap">
                <span className="flex-1 min-w-0">{item.label}</span>
                {item.is_required && state !== 'completed' && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap"
                    title="Обязательный пункт"
                    style={{
                      background: 'color-mix(in oklab, var(--color-warn) 12%, transparent)',
                      color: 'var(--color-warn)',
                      border: '1px solid color-mix(in oklab, var(--color-warn) 28%, transparent)',
                    }}
                  >
                    <AlertCircle size={9} />
                    обязательный
                  </span>
                )}
                <ChecklistStatusBadge state={state} />
              </span>
            )}
          </div>

          {/* Edit / delete справа. Появляются по hover карточки (или focus). */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {pending && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-dim)' }} />}

            {canManage && !editing && (
              <div
                className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity"
                data-no-toggle="true"
                onClick={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => { setEditValue(item.label); setEditing(true) }}
                  aria-label={`Переименовать пункт: ${item.label}`}
                  className="p-1 rounded-lg text-text-dim hover:text-text hover-surface"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label={`Удалить пункт: ${item.label}`}
                  className="p-1 rounded-lg row-icon-danger"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Action-row: assignees / deadline / accept ─────────────────
            Рендерится, если есть что показать: ассигни УЖЕ есть, ИЛИ
            canManage (тогда показываем кнопки «+ Назначить»/«+ Срок»). */}
        {(hasAssignees || canManage || item.deadline) && !editing && (
          <div
            className="checklist-card-actions"
            data-no-toggle="true"
            onClick={e => e.stopPropagation()}
          >
            <ChecklistAssigneesControl
              itemId={item.id}
              projectId={projectId}
              canManage={canManage}
              assignees={item.assignees ?? []}
              employees={employees}
            />
            <ChecklistDeadlineChip
              itemId={item.id}
              projectId={projectId}
              canManage={canManage}
              deadline={item.deadline}
              isCompleted={optimisticDone}
            />
            {canAccept && (
              <button
                type="button"
                onClick={handleAccept}
                disabled={pending}
                aria-label="Взять пункт в работу"
                className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium px-3 py-1 rounded-md disabled:opacity-50 ml-auto"
                style={{
                  background: 'color-mix(in oklab, #60a5fa 18%, transparent)',
                  color: '#60a5fa',
                  border: '1px solid color-mix(in oklab, #60a5fa 38%, transparent)',
                  boxShadow: '0 0 0 1px color-mix(in oklab, #60a5fa 14%, transparent) inset',
                }}
              >
                <Play size={12} strokeWidth={2.5} />
                Взять в работу
              </button>
            )}
          </div>
        )}

        {/* ── Timeline-мета: «Назначен …», «В работе с …», «Сдал …». ─── */}
        {(item.assigned_at || optimisticStarted || optimisticDone) && !editing && (
          <div className="flex items-center gap-1.5 flex-wrap checklist-meta">
            {item.assigned_at && !optimisticStarted && !optimisticDone && (
              <span className="inline-flex items-center gap-1">
                <span className="opacity-70">Назначен</span>
                <span className="num font-medium">{formatDateBrief(item.assigned_at)}</span>
              </span>
            )}
            {optimisticStarted && (
              <span className="inline-flex items-center gap-1">
                <span className="opacity-70">В работе с</span>
                <span className="num font-medium">{formatDateBrief(optimisticStarted)}</span>
                {item.starter?.full_name && (
                  <span className="opacity-90">· {getFirstNameLocal(item.starter.full_name)}</span>
                )}
              </span>
            )}
            {optimisticDone && item.checker && item.completed_at && (
              <>
                {optimisticStarted && <span className="opacity-40">·</span>}
                <span className="inline-flex items-center gap-1">
                  <span className="opacity-70">Сдал</span>
                  <span className="font-medium">{getFirstNameLocal(item.checker.full_name)}</span>
                  <span className="opacity-50">·</span>
                  <span className="num">{formatDateBrief(item.completed_at)}</span>
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Связанные задачи — внутри карточки, нижняя полоска. data-no-toggle гасит
          клик по карточке, чтобы линк работал без переключения выполнено. */}
      {linkedTasks.length > 0 && (
        <div data-no-toggle="true" onClick={e => e.stopPropagation()}>
          <LinkedTasksRow tasks={linkedTasks} />
        </div>
      )}

    {/* Inline-подтверждение: пункт отмечен ДРУГИМ пользователем, и кто-то
        тапнул чекбокс. Чтобы случайный клик не стёр чужую работу — спрашиваем. */}
    {confirmUncheck && (
      <div
        data-no-toggle="true"
        onClick={e => e.stopPropagation()}
        className="px-3 pb-3 pt-1"
      >
        <div
          className="px-3 py-2 rounded-lg text-xs flex items-start gap-2"
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

/** «17 мар, 14:32» — день + точное время по Asia/Oral. */
function formatDateBrief(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      timeZone: 'Asia/Oral',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch { return '' }
}

/** Имя без отчества — для компактности в timeline. */
function getFirstNameLocal(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  // ФИО → «Иванов И.», иначе оставляем как есть.
  if (parts.length >= 2) return `${parts[0]} ${parts[1].charAt(0)}.`
  return fullName
}

/** Дедлайн (YYYY-MM-DD) уже прошёл по Asia/Oral. */
function isPastOral(deadline: string): boolean {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Oral' })  // YYYY-MM-DD
    return deadline < today
  } catch { return false }
}

// ─── Связанные задачи под пунктом чек-листа ──────────────────────────────────
function LinkedTasksRow({ tasks }: { tasks: TaskRef[] }) {
  const params = useParams()
  const search = useSearchParams()
  const projectId = (params?.id as string | undefined) ?? ''
  // Сохраняем существующие query-параметры, переключаем view на tasks.
  const qs = new URLSearchParams(search?.toString() ?? '')
  qs.set('view', 'tasks')
  const href = projectId ? `/dashboard/projects/${projectId}?${qs.toString()}` : '#'

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-3 pb-2.5 pt-0">
      <span className="text-[10px] uppercase tracking-wider text-text-dim font-semibold">Задачи:</span>
      {tasks.map(t => {
        const statusKey = String(t.status ?? 'todo')
        const cfg = TASK_STATUS_DOT[statusKey] ?? TASK_STATUS_DOT.todo
        const isDone = statusKey === 'done'
        return (
          <Link
            key={t.id}
            href={href}
            className="checklist-task-chip inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md"
            title={`${t.title} · ${cfg.label}`}
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-2)',
              color: 'var(--color-text-muted)',
              textDecoration: isDone ? 'line-through' : 'none',
              opacity: isDone ? 0.7 : 1,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: cfg.color }}
              aria-label={cfg.label}
            />
            <span className="truncate max-w-[200px]">{t.title}</span>
          </Link>
        )
      })}
    </div>
  )
}

