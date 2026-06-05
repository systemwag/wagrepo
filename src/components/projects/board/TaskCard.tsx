'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, Calendar, Link2, ListTree, MoreVertical, MoveRight, Trash2,
  Loader2, CheckCircle2, Check, X, AlertCircle, MessageSquare, RotateCcw, Play,
} from 'lucide-react'
import {
  deleteProjectTask,
  updateProjectTaskStatus,
  updateProjectTaskDeadline,
  markProjectTaskFailed,
} from '@/lib/actions/project-tasks'
import { acceptHandover, rejectHandover } from '@/lib/actions/handover'
import DatePickerPopover from '@/components/ui/DatePickerPopover'
import { AvatarGroup } from './StageAssignee'
import { formatNameShort } from '@/lib/utils/name'
import { PRIORITY_LABEL, PRIORITY_STYLE, taskTheme, type Task } from './_shared'

interface Props {
  task: Task
  canManage: boolean
  isDirector: boolean
  projectId: string
  accentColor: string
  /** Текущий пользователь — для определения «я исполнитель». */
  currentUserId?: string
  /** Сколько у задачи подзадач всего (если >0 — показываем бэдж) */
  subtasksTotal?: number
  /** Сколько подзадач выполнено */
  subtasksDone?: number
  /** Открыть меню «Переместить в другой этап» */
  onRequestMove: () => void
  onDeleted: () => void
}

type Prompt = null | 'reject' | 'fail'

export default function TaskCard({
  task,
  canManage,
  isDirector,
  projectId,
  accentColor,
  currentUserId,
  subtasksTotal,
  subtasksDone,
  onRequestMove,
  onDeleted,
}: Props) {
  const [status, applyOptimisticStatus] = useOptimistic(
    task.status ?? 'todo',
    (_current: string, next: string) => next,
  )
  const [deadline, applyOptimisticDeadline] = useOptimistic(
    task.deadline ?? null,
    (_current: string | null, next: string | null) => next,
  )
  const isOverdue = deadline && new Date(deadline) < new Date() && status !== 'done' && status !== 'failed'
  const isDone = status === 'done'
  const isFailed = status === 'failed'
  const isAssignee = !!currentUserId && (task.assignees ?? []).some(a => a.id === currentUserId)

  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [prompt, setPrompt] = useState<Prompt>(null)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const [deadlineOpen, setDeadlineOpen] = useState(false)
  const [deadlinePending, startDeadlineTransition] = useTransition()
  const deadlineBtnRef = useRef<HTMLButtonElement>(null)

  function changeDeadline(iso: string | null) {
    setDeadlineOpen(false)
    startDeadlineTransition(async () => {
      applyOptimisticDeadline(iso)
      const res = await updateProjectTaskDeadline(task.id, iso, projectId)
      if (!res?.error) router.refresh()
    })
  }

  type ActionResult = { error?: string | null } | null | undefined
  function run(fn: () => Promise<ActionResult>, optimisticNext?: string) {
    startTransition(async () => {
      if (optimisticNext) applyOptimisticStatus(optimisticNext)
      const result = await fn()
      if (!result?.error) router.refresh()
    })
  }

  function handleAccept() {
    run(() => acceptHandover('project', task.id), 'in_progress')
  }

  function handleReject() {
    const r = reason.trim()
    if (!r) return
    // Отклонение убирает исполнителя — карточка скроется после refresh.
    // Оптимистично статус не трогаем: задача физически уходит из колонки, не меняет state.
    run(async () => {
      const result = await rejectHandover('project', task.id, r)
      if (!result?.error) { setPrompt(null); setReason('') }
      return result
    })
  }

  function handleDone() {
    run(() => updateProjectTaskStatus(task.id, 'done', projectId), 'done')
  }

  function handleFail() {
    const r = reason.trim()
    if (!r) return
    run(
      async () => {
        const result = await markProjectTaskFailed(task.id, r, projectId)
        if (!result?.error) { setPrompt(null); setReason('') }
        return result
      },
      'failed',
    )
  }

  function handleResume() {
    run(() => updateProjectTaskStatus(task.id, 'in_progress', projectId), 'in_progress')
  }

  function handleDelete() {
    setMenuOpen(false)
    setDeleteConfirm(false)
    startTransition(async () => {
      const result = await deleteProjectTask(task.id, projectId)
      if (!result?.error) {
        onDeleted()
        router.refresh()
      }
    })
  }

  const pill = taskTheme(status)

  return (
    <div
      className="relative rounded-xl p-4 flex flex-col gap-3 group transition-colors"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        opacity: isDone ? 0.7 : 1,
      }}
    >
      {/* Заголовок: пилюля статуса + название + меню действий */}
      <div className="flex items-start gap-3">
        <span
          className="text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1 flex-shrink-0 mt-0.5"
          style={{ background: pill.bg, color: pill.color, border: `1px solid ${pill.border}` }}
        >
          {isDone && <CheckCircle2 size={11} />}
          {isFailed && <AlertCircle size={11} />}
          {pill.label}
        </span>

        <p
          className="text-base leading-snug font-medium flex-1"
          style={{
            color: 'var(--text)',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </p>

        {canManage && !deleteConfirm && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
              aria-label="Действия"
              className="p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-30"
                  aria-hidden
                />
                <div
                  className="absolute top-full right-0 mt-1 w-52 rounded-xl z-40 overflow-hidden"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-2)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onRequestMove() }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover-surface"
                    style={{ color: 'var(--text)' }}
                  >
                    <MoveRight size={14} />
                    Переместить в другой этап
                  </button>
                  {isDirector && (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); setDeleteConfirm(true) }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover-surface"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      <Trash2 size={14} />
                      Удалить задачу
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div
          className="flex items-center gap-2 p-2.5 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <span className="text-sm flex-1" style={{ color: '#f87171' }}>Удалить задачу?</span>
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs px-2.5 py-1 rounded-lg font-medium"
            style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}
          >
            Да
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(false)}
            className="text-xs px-2.5 py-1 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            Нет
          </button>
        </div>
      )}

      {/* Приоритет + подзадачи + дедлайн */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm px-2.5 py-1 rounded-lg font-medium" style={PRIORITY_STYLE[task.priority]}>
            {PRIORITY_LABEL[task.priority]}
          </span>
          {subtasksTotal !== undefined && subtasksTotal > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium num"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
              title="Подзадачи"
            >
              <ListTree size={12} />
              {subtasksDone ?? 0}/{subtasksTotal}
            </span>
          )}
        </div>
        {canManage ? (
          <>
            <button
              ref={deadlineBtnRef}
              type="button"
              onClick={() => setDeadlineOpen(o => !o)}
              disabled={deadlinePending}
              className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg transition-colors hover-surface disabled:opacity-50"
              style={{
                color: isOverdue ? '#f87171' : deadline ? 'var(--text-muted)' : 'var(--text-dim)',
                border: '1px solid var(--border)',
              }}
              title="Изменить срок"
            >
              {deadlinePending
                ? <Loader2 size={13} className="animate-spin" />
                : isOverdue ? <AlertTriangle size={13} /> : <Calendar size={13} />}
              {deadline
                ? new Date(deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })
                : 'Срок'}
            </button>
            {deadlineOpen && (
              <DatePickerPopover
                value={deadline}
                onChange={changeDeadline}
                onClose={() => setDeadlineOpen(false)}
                anchorRef={deadlineBtnRef}
                accentColor={accentColor}
                ariaLabel="Срок задачи"
              />
            )}
          </>
        ) : deadline && (
          <span className="flex items-center gap-1 text-sm" style={{ color: isOverdue ? '#f87171' : 'var(--text-muted)' }}>
            {isOverdue ? <AlertTriangle size={13} /> : <Calendar size={13} />}
            {new Date(deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {/* Связанный пункт чек-листа */}
      {task.checklist_item && (
        <div
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <Link2 size={12} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <span className="text-sm truncate" style={{ color: 'var(--text-dim)' }}>{task.checklist_item.label}</span>
        </div>
      )}

      {/* Исполнители — несколько (avatar group + имя первого) */}
      {task.assignees && task.assignees.length > 0 && (
        <div className="flex items-center gap-2 min-w-0">
          <AvatarGroup people={task.assignees} stageColor={accentColor} max={3} size={24} />
          <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
            {task.assignees.length === 1
              ? task.assignees[0].full_name
              : `${formatNameShort(task.assignees[0].full_name)} +${task.assignees.length - 1}`}
          </span>
        </div>
      )}

      {/* Комментарий исполнителя — причина отклонения / «не завершено». */}
      {task.employee_note && (isFailed || status === 'todo' || isDone) && (
        <div
          className="flex gap-2 px-2.5 py-2 rounded-lg"
          style={{
            background: isFailed
              ? 'color-mix(in oklab, var(--color-danger) 8%, transparent)'
              : 'var(--color-surface-2)',
            border: `1px solid ${isFailed
              ? 'color-mix(in oklab, var(--color-danger) 25%, transparent)'
              : 'var(--color-border)'}`,
          }}
        >
          <MessageSquare
            size={12}
            className="shrink-0 mt-0.5"
            style={{ color: isFailed ? 'var(--color-danger)' : 'var(--color-text-dim)' }}
          />
          <span className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {task.employee_note}
          </span>
        </div>
      )}

      {/* Inline-prompt для причины отклонения / «не завершено». */}
      {prompt && (
        <div
          className="flex flex-col gap-2 p-2.5 rounded-lg"
          style={{
            background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
            border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)',
          }}
        >
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={prompt === 'reject' ? 'Почему отклоняете задачу?' : 'Что не получилось?'}
            rows={2}
            className="w-full bg-transparent text-sm outline-none resize-none"
            style={{ color: 'var(--color-text)' }}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prompt === 'reject' ? handleReject : handleFail}
              disabled={pending || !reason.trim()}
              className="text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 disabled:opacity-40"
              style={{ background: 'var(--color-danger)', color: '#1a0a0a' }}
            >
              {pending && <Loader2 size={11} className="animate-spin" />}
              Подтвердить
            </button>
            <button
              type="button"
              onClick={() => { setPrompt(null); setReason('') }}
              disabled={pending}
              className="text-xs px-2 py-1.5 rounded-lg"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Действия сотрудника / возврат директором. */}
      {!prompt && !deleteConfirm && (
        <>
          {isAssignee && status === 'todo' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAccept}
                disabled={pending}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium disabled:opacity-40"
                style={{ background: 'var(--color-green)', color: '#040d07' }}
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                Принять
              </button>
              <button
                type="button"
                onClick={() => setPrompt('reject')}
                disabled={pending}
                className="flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium"
                style={{
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <X size={14} />
                Отклонить
              </button>
            </div>
          )}

          {isAssignee && status === 'in_progress' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDone}
                disabled={pending}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium disabled:opacity-40"
                style={{ background: 'var(--color-green)', color: '#040d07' }}
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                Завершить
              </button>
              <button
                type="button"
                onClick={() => setPrompt('fail')}
                disabled={pending}
                className="flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium"
                style={{
                  background: 'color-mix(in oklab, var(--color-danger) 10%, transparent)',
                  color: 'var(--color-danger)',
                  border: '1px solid color-mix(in oklab, var(--color-danger) 25%, transparent)',
                }}
              >
                <AlertCircle size={14} />
                Не завершено
              </button>
            </div>
          )}

          {canManage && (isDone || isFailed) && (
            <button
              type="button"
              onClick={handleResume}
              disabled={pending}
              className="flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium disabled:opacity-40"
              style={{
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={14} />}
              Вернуть в работу
            </button>
          )}

          {/* Если задача todo, исполнитель не я, но я директор/менеджер — можно
              «толкнуть» задачу прямо в работу без handover (legacy-кейс). */}
          {!isAssignee && canManage && status === 'todo' && task.assignees && task.assignees.length > 0 && (
            <button
              type="button"
              onClick={() => run(() => updateProjectTaskStatus(task.id, 'in_progress', projectId), 'in_progress')}
              disabled={pending}
              className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Поставить в работу
            </button>
          )}
        </>
      )}
    </div>
  )
}
