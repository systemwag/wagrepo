'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { DesignStage, StageDocument, StageStatus, ReviewStatus, ChecklistItem } from '@/lib/constants/design-stages'
import { REVIEW_STATUS_LABEL } from '@/lib/constants/design-stages'
import { updateStageStatus, updateStageDeadline, assignStageResponsible, updateStageReview, deleteStageDocument } from '@/lib/actions/stages'
import DatePicker from '@/components/ui/DatePicker'
import { deleteStage } from '@/lib/actions/projects'
import { toggleChecklistItem, addChecklistItem, deleteChecklistItem } from '@/lib/actions/checklist'
import { createClient } from '@/lib/supabase/client'
import StageStatusBadge from './StageStatusBadge'
import {
  User, Calendar, CheckSquare, FileText, ShieldCheck,
  ChevronDown, ChevronUp, Plus, X, Paperclip, Check,
  Clock, AlertTriangle, FileImage, File, Loader2,
  ClipboardList, Star, RotateCcw, Lock, Trash2,
} from 'lucide-react'

type Employee = { id: string; full_name: string }
type TaskRef = { id: string; title: string; checklist_item_id: string | null }

type Props = {
  stages: DesignStage[]
  tasks: TaskRef[]
  projectId: string
  userRole: string
  canManage: boolean
  employees: Employee[]
}

// Уникальный цвет для каждого этапа (по порядковому индексу)
const STAGE_COLORS = [
  { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  glow: 'rgba(59,130,246,0.08)'  }, // синий
  { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  glow: 'rgba(16,185,129,0.08)'  }, // изумрудный
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  glow: 'rgba(245,158,11,0.08)'  }, // янтарный
  { color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  glow: 'rgba(168,85,247,0.08)'  }, // фиолетовый
  { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   glow: 'rgba(6,182,212,0.08)'   }, // циан
  { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  glow: 'rgba(249,115,22,0.08)'  }, // оранжевый
  { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   glow: 'rgba(244,63,94,0.08)'   }, // розовый
  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   glow: 'rgba(34,197,94,0.08)'   }, // зелёный
]

export default function ProjectPipelineView({ stages, tasks, projectId, canManage, userRole, employees }: Props) {
  const [expanded, setExpanded] = useState<string | null>(
    stages.find(s => s.status === 'in_progress')?.id ?? stages[0]?.id ?? null
  )
  const [localStages, setLocalStages] = useState(stages)
  const isDirector = userRole === 'director'

  function handleStageDeleted(stageId: string) {
    setLocalStages(prev => prev.filter(s => s.id !== stageId))
  }

  return (
    <div>
      {localStages.map((stage, idx) => (
        <div key={stage.id}>
          <StageRow
            stage={stage}
            index={idx}
            stageColor={STAGE_COLORS[idx % STAGE_COLORS.length]}
            isExpanded={expanded === stage.id}
            onToggle={() => setExpanded(prev => prev === stage.id ? null : stage.id)}
            projectId={projectId}
            canManage={canManage}
            userRole={userRole}
            isDirector={isDirector}
            employees={employees}
            tasks={tasks}
            onDeleted={() => handleStageDeleted(stage.id)}
          />
          {idx < localStages.length - 1 && (
            <div style={{ display: 'flex', height: '14px', paddingLeft: '0px' }}>
              <div style={{
                width: '2px',
                height: '14px',
                marginLeft: '39px',
                background: `linear-gradient(to bottom, ${STAGE_COLORS[idx % STAGE_COLORS.length].color}88, ${STAGE_COLORS[(idx + 1) % STAGE_COLORS.length].color}88)`,
                borderRadius: '1px',
              }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function StageRow({
  stage,
  index,
  stageColor,
  isExpanded,
  onToggle,
  projectId,
  canManage,
  userRole,
  isDirector,
  employees,
  tasks,
  onDeleted,
}: {
  stage: DesignStage
  index: number
  stageColor: typeof STAGE_COLORS[number]
  isExpanded: boolean
  onToggle: () => void
  projectId: string
  canManage: boolean
  userRole: string
  isDirector: boolean
  employees: Employee[]
  tasks: TaskRef[]
  onDeleted: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useState<StageStatus>(stage.status)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, startDeleteTransition] = useTransition()

  function handleDeleteStage() {
    startDeleteTransition(async () => {
      const result = await deleteStage(stage.id, projectId)
      if (!result?.error) onDeleted()
    })
  }

  const completedItems = stage.checklist_items.filter(i => i.is_completed).length
  const totalItems     = stage.checklist_items.length
  const checklistPct   = totalItems ? Math.round((completedItems / totalItems) * 100) : 0

  const isOverdue = stage.deadline && new Date(stage.deadline) < new Date() && optimisticStatus !== 'completed'

  function handleStatusChange(newStatus: StageStatus) {
    if (newStatus === optimisticStatus) return
    setOptimisticStatus(newStatus)
    startTransition(async () => {
      const result = await updateStageStatus(stage.id, newStatus, projectId)
      if (result.error) setOptimisticStatus(stage.status)
    })
  }

  const isDone = optimisticStatus === 'completed'

  return (
    <div className="relative">
      <div
        className="rounded-2xl overflow-hidden transition-all"
        style={{
          background: isExpanded ? 'var(--surface)' : 'transparent',
          border: `1px solid ${isExpanded ? stageColor.color + '55' : 'transparent'}`,
          boxShadow: isExpanded ? `0 4px 24px ${stageColor.color}18` : 'none',
        }}
      >
        {/* Левый цветной акцент этапа */}
        <div className="flex">
          {isExpanded && (
            <div
              className="w-1 flex-shrink-0 rounded-l-2xl"
              style={{ background: `linear-gradient(to bottom, ${stageColor.color}, ${stageColor.color}66)` }}
            />
          )}

          <div className="flex-1 min-w-0">
            {/* Заголовок этапа */}
            <div
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group relative cursor-pointer"
              style={{ color: 'var(--text)' }}
              onClick={onToggle}
              onMouseEnter={e => {
                if (!isExpanded) {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = stageColor.glow
                }
              }}
              onMouseLeave={e => {
                if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onToggle() }}
            >
              {/* Номер с цветом этапа */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0 transition-all"
                style={{
                  background: isDone ? stageColor.color : stageColor.bg,
                  color: isDone ? '#000' : stageColor.color,
                  border: `2px solid ${isDone ? stageColor.color : stageColor.color + '55'}`,
                  boxShadow: isExpanded ? `0 0 16px ${stageColor.color}44` : 'none',
                }}
              >
                {isDone ? (
                  <Check size={18} strokeWidth={3} />
                ) : optimisticStatus === 'blocked' ? (
                  <Lock size={15} />
                ) : (
                  index + 1
                )}
              </div>

              {/* Название + мета */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className="font-semibold text-base"
                    style={{ color: optimisticStatus === 'completed' ? 'var(--text-muted)' : 'var(--text)' }}
                  >
                    {stage.name}
                  </span>
                  <StageStatusBadge status={optimisticStatus} />
                  {stage.review_status === 'approved' && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.25)' }}>
                      <ShieldCheck size={11} />
                      Одобрено
                    </span>
                  )}
                  {stage.review_status === 'revision_needed' && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(249,115,22,0.1)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' }}>
                      <RotateCcw size={11} />
                      На доработку
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {stage.assignee && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <User size={11} />
                      {stage.assignee.full_name}
                    </span>
                  )}
                  {stage.deadline && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: isOverdue ? '#f87171' : 'var(--text-dim)' }}>
                      {isOverdue ? <AlertTriangle size={11} /> : <Calendar size={11} />}
                      {new Date(stage.deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' })}
                    </span>
                  )}
                  {totalItems > 0 && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-dim)' }}>
                      <CheckSquare size={11} />
                      {completedItems}/{totalItems}
                    </span>
                  )}
                  {stage.stage_documents.length > 0 && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-dim)' }}>
                      <Paperclip size={11} />
                      {stage.stage_documents.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Прогресс + шеврон + удалить */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {totalItems > 0 && (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-medium" style={{ color: checklistPct === 100 ? 'var(--green)' : 'var(--text-dim)' }}>
                      {checklistPct}%
                    </span>
                    <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-2)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${checklistPct}%`, background: checklistPct === 100 ? 'var(--green)' : '#60a5fa' }}
                      />
                    </div>
                  </div>
                )}
                {isExpanded
                  ? <ChevronUp size={16} style={{ color: 'var(--text-dim)' }} />
                  : <ChevronDown size={16} style={{ color: 'var(--text-dim)' }} />
                }
                {isDirector && (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(true) }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                    style={{ color: 'var(--text-dim)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    title="Удалить этап"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Подтверждение удаления этапа */}
            {deleteConfirm && (
              <div className="mx-4 mb-3 px-4 py-3 rounded-xl flex items-center justify-between gap-3"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm" style={{ color: 'var(--text)' }}>
                  Удалить этап <strong>«{stage.name}»</strong>?
                  <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Чек-лист и файлы этапа будут удалены
                  </span>
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setDeleteConfirm(false)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)' }}>
                    Отмена
                  </button>
                  <button
                    onClick={handleDeleteStage}
                    disabled={deleting}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Удалить
                  </button>
                </div>
              </div>
            )}

            {/* Раскрытое тело */}
            {isExpanded && (
              <div>
                <div style={{ height: '1px', background: 'var(--border)', margin: '0 16px' }} />
                <div className="px-4 pt-4 pb-5">
                  <div className="ml-[56px] space-y-5">

                  {/* Ответственный */}
                  <AssigneeButtons stage={stage} employees={employees} projectId={projectId} canManage={canManage} />

                  {/* Дедлайн */}
                  <DeadlinePicker stage={stage} projectId={projectId} canManage={canManage} />

                  {/* Чек-лист */}
                  <ChecklistPanel
                    stage={stage}
                    projectId={projectId}
                    canManage={canManage}
                    completedItems={completedItems}
                    totalItems={totalItems}
                    tasks={tasks}
                  />

                  {/* Заметки */}
                  {stage.notes && (
                    <p className="text-sm px-3.5 py-2.5 rounded-xl"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {stage.notes}
                    </p>
                  )}

                  {/* Выбор статуса */}
                  {canManage && (
                    <StatusSelector current={optimisticStatus} disabled={pending} onChange={handleStatusChange} />
                  )}

                  {/* Проверка начальника */}
                  <ReviewPanel stage={stage} projectId={projectId} userRole={userRole} />

                  {/* Документы */}
                  <DocumentsPanel stage={stage} projectId={projectId} canManage={canManage} />

                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Переиспользуемый блок-секция ────────────────────────────────────────────
function SectionBlock({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  count?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: 'var(--text-dim)' }}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{title}</span>
        {count && <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>{count}</span>}
      </div>
      {children}
    </div>
  )
}

// ─── Статус-селектор ─────────────────────────────────────────────────────────
const STATUS_CONFIG: {
  value: StageStatus
  label: string
  icon: React.ReactNode
  bg: string
  color: string
  border: string
}[] = [
  { value: 'pending',     label: 'Ожидание',    icon: <Clock size={13} />,         bg: 'var(--surface-2)',       color: 'var(--text-muted)', border: 'var(--border-2)' },
  { value: 'in_progress', label: 'В работе',    icon: <Loader2 size={13} />,       bg: 'rgba(59,130,246,0.1)',   color: '#60a5fa',           border: 'rgba(59,130,246,0.25)' },
  { value: 'completed',   label: 'Завершён',    icon: <Check size={13} />,         bg: 'var(--green-glow)',      color: 'var(--green)',      border: 'rgba(34,197,94,0.25)' },
  { value: 'blocked',     label: 'Заблокирован',icon: <Lock size={13} />,          bg: 'rgba(239,68,68,0.1)',    color: '#f87171',           border: 'rgba(239,68,68,0.25)' },
]

function StatusSelector({
  current,
  disabled,
  onChange,
}: {
  current: StageStatus
  disabled: boolean
  onChange: (s: StageStatus) => void
}) {
  return (
    <SectionBlock icon={<Star size={13} />} title="Статус этапа">
      <div className="flex gap-2 flex-wrap">
        {STATUS_CONFIG.map(cfg => {
          const isActive = cfg.value === current
          return (
            <button
              key={cfg.value}
              onClick={() => onChange(cfg.value)}
              disabled={disabled}
              className="flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-xl font-medium transition-all disabled:opacity-40"
              style={{
                background: isActive ? cfg.bg : 'transparent',
                color: isActive ? cfg.color : 'var(--text-dim)',
                border: `1px solid ${isActive ? cfg.border : 'var(--border)'}`,
                outline: isActive ? `2px solid ${cfg.border}` : 'none',
                outlineOffset: '1px',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLElement).style.background = cfg.bg
                  ;(e.currentTarget as HTMLElement).style.color = cfg.color
                  ;(e.currentTarget as HTMLElement).style.borderColor = cfg.border
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                }
              }}
            >
              {cfg.icon}
              {cfg.label}
            </button>
          )
        })}
      </div>
    </SectionBlock>
  )
}

// ─── Ответственный (кнопки) ──────────────────────────────────────────────────
function AssigneeButtons({
  stage,
  employees,
  projectId,
  canManage,
}: {
  stage: DesignStage
  employees: Employee[]
  projectId: string
  canManage: boolean
}) {
  const [saving, startTransition] = useTransition()
  const [optimisticAssignee, setOptimisticAssignee] = useState<Employee | null>(stage.assignee ?? null)

  function assign(emp: Employee | null) {
    setOptimisticAssignee(emp)
    startTransition(async () => {
      const result = await assignStageResponsible(stage.id, emp?.id ?? null, projectId)
      if (result.error) setOptimisticAssignee(stage.assignee ?? null)
    })
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <User size={12} style={{ color: 'var(--text-dim)' }} />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Ответственный</p>
        {optimisticAssignee && canManage && (
          <button
            onClick={() => assign(null)}
            disabled={saving}
            className="ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg transition-colors disabled:opacity-40"
            style={{ color: '#f87171' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <X size={11} />
            Снять
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {employees.map(emp => {
          const selected = emp.id === optimisticAssignee?.id
          return (
            <button
              key={emp.id}
              type="button"
              disabled={!canManage || saving}
              onClick={() => assign(selected ? null : emp)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all disabled:opacity-50"
              style={{
                background: selected ? 'var(--green-glow)' : 'var(--surface-2)',
                border: `1px solid ${selected ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                color: selected ? 'var(--green)' : 'var(--text)',
                cursor: canManage ? 'pointer' : 'default',
              }}
              onMouseEnter={e => { if (canManage && !selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)' }}
              onMouseLeave={e => { if (canManage && !selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  background: selected ? 'rgba(34,197,94,0.25)' : 'var(--border-2)',
                  color: selected ? 'var(--green)' : 'var(--text-muted)',
                }}
              >
                {emp.full_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium">{emp.full_name}</span>
              {selected && <Check size={13} style={{ flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Дедлайн ─────────────────────────────────────────────────────────────────
function DeadlinePicker({
  stage,
  projectId,
  canManage,
}: {
  stage: DesignStage
  projectId: string
  canManage: boolean
}) {
  const [saving, startTransition] = useTransition()
  const [optimisticDeadline, setOptimisticDeadline] = useState<string>(stage.deadline ?? '')

  const isOverdue = optimisticDeadline && new Date(optimisticDeadline) < new Date() && stage.status !== 'completed'

  function handleChange(val: string) {
    setOptimisticDeadline(val)
    startTransition(async () => {
      const result = await updateStageDeadline(stage.id, val || null, projectId)
      if (result.error) setOptimisticDeadline(stage.deadline ?? '')
    })
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Calendar size={12} style={{ color: isOverdue ? '#f87171' : 'var(--text-dim)' }} />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: isOverdue ? '#f87171' : 'var(--text-dim)' }}>
          Дедлайн{isOverdue && ' · просрочен'}
        </p>
      </div>
      <DatePicker
        value={optimisticDeadline}
        onChange={handleChange}
        placeholder="дд.мм.гггг"
        disabled={!canManage || saving}
        accentColor={isOverdue ? '#f87171' : undefined}
      />
    </div>
  )
}

// ─── Чек-лист панель ─────────────────────────────────────────────────────────
function ChecklistPanel({
  stage,
  projectId,
  canManage,
  completedItems: _completedItems,
  totalItems: _totalItems,
  tasks,
}: {
  stage: DesignStage
  projectId: string
  canManage: boolean
  completedItems: number
  totalItems: number
  tasks: TaskRef[]
}) {
  const [items, setItems] = useState<ChecklistItem[]>(stage.checklist_items)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    }
    setNewLabel('')
    setAdding(false)
    setSaving(false)
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    deleteChecklistItem(id, projectId)
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

        {/* Строка добавления */}
        {adding && (
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: items.length > 0 ? '1px solid var(--border)' : 'none' }}>
            <div className="w-[18px] h-[18px] rounded-md flex-shrink-0" style={{ border: '2px solid var(--border-2)' }} />
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
              onClick={() => { setAdding(false); setNewLabel('') }}
              className="p-1 rounded-lg transition-colors"
              style={{ color: 'var(--text-dim)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Кнопка добавить */}
        {canManage && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2.5 transition-colors"
            style={{
              color: 'var(--green)',
              background: 'var(--surface-2)',
              borderTop: items.length > 0 ? '1px solid var(--border)' : 'none',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--green-glow)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
          >
            <Plus size={14} />
            Добавить пункт
          </button>
        )}
      </div>
    </SectionBlock>
  )
}

// ─── Чек-лист строка ─────────────────────────────────────────────────────────
function ChecklistRow({
  item,
  projectId,
  canManage,
  linkedTasks,
  onDelete,
}: {
  item: ChecklistItem
  projectId: string
  canManage: boolean
  linkedTasks: TaskRef[]
  onDelete: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [optimisticDone, setOptimisticDone] = useState(item.is_completed)

  function handleToggle() {
    const next = !optimisticDone
    setOptimisticDone(next)
    startTransition(async () => {
      const result = await toggleChecklistItem(item.id, next, projectId)
      if (result.error) setOptimisticDone(!next)
    })
  }

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 group transition-colors"
      style={{ background: 'transparent' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      <button
        onClick={handleToggle}
        disabled={pending}
        className="flex items-center gap-3 flex-1 text-left min-w-0 disabled:opacity-60"
      >
        <div
          className="flex-shrink-0 transition-all"
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '5px',
            background: optimisticDone ? 'var(--green)' : 'transparent',
            border: `2px solid ${optimisticDone ? 'var(--green)' : 'var(--border-2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {optimisticDone && <Check size={11} color="#040d07" strokeWidth={3} />}
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
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded-lg"
          style={{ color: 'var(--text-dim)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          title="Удалить пункт"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

// ─── Панель проверки директора ────────────────────────────────────────────────
const REVIEW_CONFIG: {
  value: ReviewStatus
  label: string
  icon: React.ReactNode
  bg: string
  color: string
  border: string
}[] = [
  { value: 'pending_review',  label: 'На проверке',  icon: <Clock size={13} />,         bg: 'rgba(234,179,8,0.1)',  color: '#ca8a04', border: 'rgba(234,179,8,0.25)' },
  { value: 'approved',        label: 'Одобрено',     icon: <ShieldCheck size={13} />,   bg: 'var(--green-glow)',    color: 'var(--green)', border: 'rgba(34,197,94,0.25)' },
  { value: 'revision_needed', label: 'На доработку', icon: <RotateCcw size={13} />,     bg: 'rgba(249,115,22,0.1)', color: '#fb923c', border: 'rgba(249,115,22,0.25)' },
]

function ReviewPanel({
  stage,
  projectId,
  userRole,
}: {
  stage: DesignStage
  projectId: string
  userRole: string
}) {
  const [pending, startTransition] = useTransition()
  const [optimisticReview, setOptimisticReview] = useState<ReviewStatus | null>(stage.review_status)
  const isDirector = userRole === 'director'

  function handleChange(val: ReviewStatus) {
    const next = val === optimisticReview ? null : val
    setOptimisticReview(next)
    startTransition(async () => {
      const result = await updateStageReview(stage.id, next, projectId)
      if (result.error) setOptimisticReview(stage.review_status)
    })
  }

  const activeCfg = REVIEW_CONFIG.find(c => c.value === optimisticReview)

  return (
    <SectionBlock icon={<ShieldCheck size={13} />} title="Проверка руководителя">
      <div
        className="rounded-xl p-3"
        style={{
          background: 'var(--surface-2)',
          border: activeCfg ? `1px solid ${activeCfg.border}` : '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between mb-2.5">
          {activeCfg ? (
            <span
              className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full font-medium"
              style={{ background: activeCfg.bg, color: activeCfg.color, border: `1px solid ${activeCfg.border}` }}
            >
              {activeCfg.icon}
              {REVIEW_STATUS_LABEL[optimisticReview!]}
            </span>
          ) : (
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>Не проверено</span>
          )}
        </div>

        {isDirector ? (
          <div className="flex gap-2 flex-wrap">
            {REVIEW_CONFIG.map(cfg => {
              const isActive = cfg.value === optimisticReview
              return (
                <button
                  key={cfg.value}
                  onClick={() => handleChange(cfg.value)}
                  disabled={pending}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-medium transition-all disabled:opacity-40"
                  style={{
                    background: isActive ? cfg.bg : 'transparent',
                    color: isActive ? cfg.color : 'var(--text-dim)',
                    border: `1px solid ${isActive ? cfg.border : 'var(--border)'}`,
                    outline: isActive ? `2px solid ${cfg.border}` : 'none',
                    outlineOffset: '1px',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      ;(e.currentTarget as HTMLElement).style.background = cfg.bg
                      ;(e.currentTarget as HTMLElement).style.color = cfg.color
                      ;(e.currentTarget as HTMLElement).style.borderColor = cfg.border
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
                      ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                    }
                  }}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              )
            })}
          </div>
        ) : (
          !optimisticReview && (
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Ожидается проверка руководителя</p>
          )
        )}
      </div>
    </SectionBlock>
  )
}

// ─── Документы этапа ─────────────────────────────────────────────────────────
const BUCKET = 'project-files'
const ALLOWED_TYPES = '.pdf,.jpg,.jpeg,.png'

function getMimeIcon(mime: string | null) {
  if (!mime) return <File size={16} style={{ color: 'var(--text-dim)' }} />
  if (mime === 'application/pdf') return <FileText size={16} style={{ color: '#f87171' }} />
  if (mime.startsWith('image/')) return <FileImage size={16} style={{ color: '#60a5fa' }} />
  return <File size={16} style={{ color: 'var(--text-dim)' }} />
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

function DocumentsPanel({
  stage,
  projectId,
  canManage,
}: {
  stage: DesignStage
  projectId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [docs, setDocs] = useState<StageDocument[]>(stage.stage_documents ?? [])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `projects/${projectId}/stages/${stage.id}/${Date.now()}.${ext}`

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false })

    if (storageError) {
      setUploadError(storageError.message)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
        project_id:  projectId,
        stage_id:    stage.id,
        name:        file.name,
        file_path:   path,
        file_size:   file.size,
        mime_type:   file.type,
        uploaded_by: user!.id,
      })
      .select()
      .single()

    if (dbError) {
      setUploadError(dbError.message)
    } else if (doc) {
      setDocs(prev => [...prev, doc as StageDocument])
      router.refresh()
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDelete(doc: StageDocument) {
    setDeletingId(doc.id)
    const result = await deleteStageDocument(doc.id, doc.file_path, projectId)
    if (!result.error) {
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      router.refresh()
    }
    setDeletingId(null)
  }

  async function handleOpen(doc: StageDocument) {
    const supabase = createClient()
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60 * 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <SectionBlock icon={<Paperclip size={13} />} title="Документы" count={docs.length > 0 ? String(docs.length) : undefined}>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>

        {/* Ошибка */}
        {uploadError && (
          <div className="px-3 py-2 flex items-center gap-2 text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', borderBottom: '1px solid var(--border)' }}>
            <AlertTriangle size={13} />
            {uploadError}
          </div>
        )}

        {/* Список файлов */}
        {docs.length > 0 && (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 group">
                <span className="flex-shrink-0">{getMimeIcon(doc.mime_type)}</span>

                <button
                  onClick={() => handleOpen(doc)}
                  className="flex-1 text-left min-w-0 transition-colors"
                >
                  <p
                    className="text-sm font-medium truncate transition-colors"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--green)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
                  >
                    {doc.name}
                  </p>
                  {doc.file_size && (
                    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatBytes(doc.file_size)}</p>
                  )}
                </button>

                {canManage && (
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40 p-1 rounded-lg"
                    style={{ color: 'var(--text-dim)' }}
                    onMouseEnter={e => {
                      ;(e.currentTarget as HTMLElement).style.color = '#f87171'
                      ;(e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'
                    }}
                    onMouseLeave={e => {
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
                      ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    {deletingId === doc.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <X size={14} />
                    }
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Пусто */}
        {docs.length === 0 && !uploading && (
          <div className="px-3 py-4 flex items-center gap-2 justify-center">
            <Paperclip size={13} style={{ color: 'var(--text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Нет прикреплённых файлов</p>
          </div>
        )}

        {/* Кнопка загрузки */}
        {canManage && (
          <div style={{ borderTop: docs.length > 0 || uploadError ? '1px solid var(--border)' : 'none' }}>
            <label
              className="flex items-center justify-center gap-2 text-sm px-3 py-2.5 cursor-pointer transition-colors"
              style={{
                color: uploading ? 'var(--text-dim)' : 'var(--green)',
                background: 'var(--surface-2)',
              }}
              onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLElement).style.background = 'var(--green-glow)' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ALLOWED_TYPES}
                onChange={handleUpload}
                disabled={uploading}
                className="sr-only"
              />
              {uploading
                ? <><Loader2 size={14} className="animate-spin" /> Загрузка...</>
                : <><Plus size={14} /> Прикрепить файл</>
              }
            </label>
          </div>
        )}
      </div>
    </SectionBlock>
  )
}
