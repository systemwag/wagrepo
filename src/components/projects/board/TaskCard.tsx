'use client'

import { useState, useTransition } from 'react'
import {
  AlertTriangle, Calendar, Link2, ListTree, MoreVertical, MoveRight, Trash2,
  Circle, Loader2, CheckCircle2,
} from 'lucide-react'
import { deleteProjectTask, updateProjectTaskStatus } from '@/lib/actions/project-tasks'
import { AvatarGroup } from './StageAssignee'
import { PRIORITY_LABEL, PRIORITY_STYLE, type Task } from './_shared'

interface Props {
  task: Task
  canManage: boolean
  isDirector: boolean
  projectId: string
  accentColor: string
  /** Сколько у задачи подзадач всего (если >0 — показываем бэдж) */
  subtasksTotal?: number
  /** Сколько подзадач выполнено */
  subtasksDone?: number
  /** Открыть меню «Переместить в другой этап» */
  onRequestMove: () => void
  onDeleted: () => void
}

export default function TaskCard({
  task,
  canManage,
  isDirector,
  projectId,
  accentColor,
  subtasksTotal,
  subtasksDone,
  onRequestMove,
  onDeleted,
}: Props) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date()
  const isDone = task.status === 'done'
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [pending, startTransition] = useTransition()

  // Цикл статусов по клику на чекбокс: todo → in_progress → done → todo
  function cycleStatus() {
    const next: Record<string, string> = {
      todo:        'in_progress',
      in_progress: 'done',
      done:        'todo',
    }
    const target = next[task.status ?? 'todo'] ?? 'todo'
    startTransition(async () => {
      await updateProjectTaskStatus(task.id, target, projectId)
    })
  }

  function handleDelete() {
    setMenuOpen(false)
    setDeleteConfirm(false)
    startTransition(async () => {
      const result = await deleteProjectTask(task.id, projectId)
      if (!result?.error) onDeleted()
    })
  }

  return (
    <div
      className="relative rounded-xl p-4 flex flex-col gap-3 group transition-colors"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        opacity: isDone ? 0.65 : 1,
      }}
    >
      {/* Заголовок: статус-чекбокс + название + меню действий */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={cycleStatus}
          disabled={pending}
          className="shrink-0 mt-0.5 transition-colors"
          aria-label={`Изменить статус (сейчас: ${task.status ?? 'todo'})`}
          title={
            task.status === 'done' ? 'Готово'
            : task.status === 'in_progress' ? 'В работе'
            : 'Сделать в работу'
          }
        >
          {pending ? (
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
          ) : task.status === 'done' ? (
            <CheckCircle2 size={18} style={{ color: 'var(--color-green)' }} />
          ) : task.status === 'in_progress' ? (
            <Circle size={18} style={{ color: accentColor, fill: `${accentColor}33` }} />
          ) : (
            <Circle size={18} style={{ color: 'var(--color-text-dim)' }} />
          )}
        </button>

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
        {task.deadline && (
          <span className="flex items-center gap-1 text-sm" style={{ color: isOverdue ? '#f87171' : 'var(--text-muted)' }}>
            {isOverdue ? <AlertTriangle size={13} /> : <Calendar size={13} />}
            {new Date(task.deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short' })}
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
              : `${task.assignees[0].full_name.split(' ')[0]} +${task.assignees.length - 1}`}
          </span>
        </div>
      )}
    </div>
  )
}
