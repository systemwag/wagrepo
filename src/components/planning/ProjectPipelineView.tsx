'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { DesignStage, StageStatus } from '@/lib/constants/design-stages'
import { createClient } from '@/lib/supabase/client'
import { updateStageStatus, updateStageDeadline, assignStageResponsible } from '@/lib/actions/stages'
import DatePicker from '@/components/ui/DatePicker'
import { deleteStage } from '@/lib/actions/projects'
import StageStatusBadge from './StageStatusBadge'
import StageTimelineNav from './StageTimelineNav'
import SectionBlock from './stage/SectionBlock'
import ReviewPanel from './stage/ReviewPanel'
import DocumentsPanel from './stage/DocumentsPanel'
import ChecklistPanel from './stage/ChecklistPanel'
import { stageTheme } from '@/components/projects/board/_shared'
import {
  User, Calendar, CheckSquare, ShieldCheck,
  ChevronDown, ChevronUp, X, Paperclip, Check,
  Clock, AlertTriangle, Loader2,
  Star, RotateCcw, Lock, Trash2,
} from 'lucide-react'

type Employee = {
  id: string
  full_name: string
  role?: 'admin' | 'director' | 'manager' | 'employee' | string | null
  position?: string | null
}

const ROLE_LABEL: Record<string, string> = {
  admin:    'Admin',
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}

const ROLE_ORDER: Record<string, number> = {
  admin: 0, director: 1, manager: 2, employee: 3,
}
type TaskRef = { id: string; title: string; checklist_item_id: string | null }

type Props = {
  stages: DesignStage[]
  tasks: TaskRef[]
  projectId: string
  userRole: string
  canManage: boolean
  employees: Employee[]
  currentUserId?: string
}

// Цвет этапа определяется СТАТУСОМ, а не порядковым номером — фирменная
// зелёно-золотая палитра не перебивается случайной радугой. Источник темы —
// stageTheme() в _shared.ts (используется и в ProjectTasksBoard).
type StageTheme = { color: string; bg: string; glow: string }

export default function ProjectPipelineView({ stages, tasks, projectId, canManage, userRole, employees, currentUserId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()

  // Источник истины для выбранного этапа — URL (?stage=<id>). Это даёт два
  // эффекта: (1) переключение на вкладку «Задачи» помнит выбранный этап и
  // может проскроллить к нему; (2) ссылку можно поделиться с раскрытым этапом.
  const stageFromUrl = search.get('stage')
  const initialExpanded =
    (stageFromUrl && stages.some(s => s.id === stageFromUrl) ? stageFromUrl : null) ??
    stages.find(s => s.status === 'in_progress')?.id ??
    stages[0]?.id ??
    null
  const [expanded, setExpandedState] = useState<string | null>(initialExpanded)
  const [localStages, setLocalStages] = useState(stages)
  const isDirector = userRole === 'director'

  // Подхватываем свежий список этапов после router.refresh() — без этого
  // useState инициализируется один раз и игнорирует апдейты от RSC.
  useEffect(() => { setLocalStages(stages) }, [stages])

  // Запись выбранного этапа в URL — централизованно. scroll:false, чтобы не
  // дёргать вьюпорт; параметр `view` (вкладка) при этом сохраняется.
  const setExpanded = useCallback(
    (next: string | null | ((prev: string | null) => string | null)) => {
      setExpandedState(prevValue => {
        const resolved = typeof next === 'function' ? next(prevValue) : next
        const params = new URLSearchParams(search.toString())
        if (resolved) params.set('stage', resolved)
        else params.delete('stage')
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
        return resolved
      })
    },
    [router, pathname, search],
  )

  // Глубокие ссылки `#stage-X` — приходим из сводки /dashboard/tasks:
  // разворачиваем нужный этап, прокручиваем и подсвечиваем кольцом.
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#stage-')) return
    const stageId = hash.slice('#stage-'.length)
    if (!stages.some(s => s.id === stageId)) return
    setExpanded(stageId)
    requestAnimationFrame(() => {
      const node = document.getElementById(`stage-${stageId}`)
      if (!node) return
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
      node.style.transition = 'box-shadow 1.6s ease'
      node.style.boxShadow = '0 0 0 2px color-mix(in oklab, var(--color-green) 60%, transparent)'
      setTimeout(() => { node.style.boxShadow = '' }, 1800)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: слушаем UPDATE/INSERT/DELETE по этапам, чек-листу и документам
  // проекта. На любое изменение делаем router.refresh() с debounce — RSC
  // принесёт свежие props с join'ами (assignee, checker), а useEffect-syncs
  // в дочерних компонентах подхватят их в локальные state'ы.
  useEffect(() => {
    const supabase = createClient()
    const stageIdSet = new Set(stages.map(s => s.id))
    let timer: ReturnType<typeof setTimeout> | null = null

    function scheduleRefresh() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 400)
    }

    const channel = supabase
      .channel(`project-stages-${projectId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'project_stages', filter: `project_id=eq.${projectId}` },
        scheduleRefresh,
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stage_checklist_items' },
        (payload) => {
          // Фильтр по проекту через известный список stage_id — payload содержит stage_id и в new, и в old.
          const row = (payload.new ?? payload.old) as { stage_id?: string } | null
          if (row?.stage_id && stageIdSet.has(row.stage_id)) scheduleRefresh()
        },
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `project_id=eq.${projectId}` },
        scheduleRefresh,
      )
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [projectId, router, stages])

  function handleStageDeleted(stageId: string) {
    setLocalStages(prev => prev.filter(s => s.id !== stageId))
  }

  const expandedIdx   = localStages.findIndex(s => s.id === expanded)
  const expandedStage = expandedIdx >= 0 ? localStages[expandedIdx] : null

  return (
    <>
      {/* Мобильный: вертикальный accordion — все этапы подряд. */}
      <div className="md:hidden">
        {localStages.map((stage, idx) => (
          <div key={stage.id}>
            <StageRow
              stage={stage}
              index={idx}
              stageColor={stageTheme(stage.status)}
              isExpanded={expanded === stage.id}
              onToggle={() => setExpanded(prev => prev === stage.id ? null : stage.id)}
              projectId={projectId}
              canManage={canManage}
              userRole={userRole}
              isDirector={isDirector}
              employees={employees}
              tasks={tasks}
              currentUserId={currentUserId}
              onDeleted={() => handleStageDeleted(stage.id)}
            />
            {idx < localStages.length - 1 && (
              <div style={{ display: 'flex', height: '14px' }}>
                <div style={{
                  width: '2px',
                  height: '14px',
                  marginLeft: '39px',
                  background: 'var(--color-border-2)',
                  borderRadius: '1px',
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Десктоп: timeline-навигация слева, развёрнутый этап справа. */}
      <div className="hidden md:grid md:grid-cols-[280px_1fr] md:gap-6 md:items-start">
        <StageTimelineNav
          stages={localStages}
          expandedId={expanded}
          onSelect={setExpanded}
        />
        <div>
          {expandedStage ? (
            <StageRow
              key={expandedStage.id}
              stage={expandedStage}
              index={expandedIdx}
              stageColor={stageTheme(expandedStage.status)}
              isExpanded={true}
              onToggle={() => { /* на десктопе схлопывание не нужно — переключение идёт через nav */ }}
              projectId={projectId}
              canManage={canManage}
              userRole={userRole}
              isDirector={isDirector}
              employees={employees}
              tasks={tasks}
              currentUserId={currentUserId}
              onDeleted={() => handleStageDeleted(expandedStage.id)}
            />
          ) : (
            <div
              className="rounded-2xl py-16 text-center"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Выберите этап слева
              </p>
            </div>
          )}
        </div>
      </div>
    </>
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
  currentUserId,
}: {
  stage: DesignStage
  index: number
  stageColor: StageTheme
  isExpanded: boolean
  onToggle: () => void
  projectId: string
  canManage: boolean
  userRole: string
  isDirector: boolean
  employees: Employee[]
  tasks: TaskRef[]
  onDeleted: () => void
  currentUserId?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useState<StageStatus>(stage.status)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, startDeleteTransition] = useTransition()

  // Локальный state ловит свежий статус, пришедший новыми props (после
  // router.refresh() или из realtime-канала). Иначе оптимистичный state
  // «зависает» на старом значении после возврата RSC.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOptimisticStatus(stage.status) }, [stage.status])

  function handleDeleteStage() {
    startDeleteTransition(async () => {
      const result = await deleteStage(stage.id, projectId)
      if (!result?.error) {
        onDeleted()
        router.refresh()
      }
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
      if (result.error) {
        setOptimisticStatus(stage.status)
      } else {
        // Пинаем RSC, чтобы TimelineNav слева, прогресс-бар сверху и цвет
        // карточки этапа пересчитались по новому статусу.
        router.refresh()
      }
    })
  }

  const isDone = optimisticStatus === 'completed'

  return (
    <div id={`stage-${stage.id}`} className="relative scroll-mt-20">
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
              className="stage-header w-full flex items-center gap-4 px-4 py-4 rounded-2xl group relative cursor-pointer"
              data-expanded={isExpanded ? 'true' : 'false'}
              style={{ color: 'var(--text)', ['--stage-glow' as string]: stageColor.glow }}
              onClick={onToggle}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
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
                    type="button"
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(true) }}
                    aria-label={`Удалить этап: ${stage.name}`}
                    // На свёрнутом этапе — opacity 0, появляется на hover (для скрытия шума).
                    // На раскрытом — всегда видна (важно для mobile: hover-а нет).
                    className={`w-7 h-7 rounded-lg flex items-center justify-center row-icon-danger transition-opacity ${
                      isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                    }`}
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
                    tasks={tasks}
                    currentUserId={currentUserId}
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
              type="button"
              onClick={() => onChange(cfg.value)}
              disabled={disabled}
              aria-pressed={isActive}
              className="chip-themed flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-xl font-medium"
              data-active={isActive ? 'true' : 'false'}
              style={{
                ['--chip-bg' as string]: cfg.bg,
                ['--chip-color' as string]: cfg.color,
                ['--chip-border' as string]: cfg.border,
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
  const router = useRouter()
  const [saving, startTransition] = useTransition()
  const [optimisticAssignee, setOptimisticAssignee] = useState<Employee | null>(stage.assignee ?? null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOptimisticAssignee(stage.assignee ?? null) }, [stage.assignee])

  function assign(emp: Employee | null) {
    setOptimisticAssignee(emp)
    startTransition(async () => {
      const result = await assignStageResponsible(stage.id, emp?.id ?? null, projectId)
      if (result.error) setOptimisticAssignee(stage.assignee ?? null)
      else router.refresh()
    })
  }

  // Группируем сотрудников по ролям (director → manager → employee), внутри роли — по имени.
  const employeesByRole = (() => {
    const groups = new Map<string, Employee[]>()
    for (const emp of employees) {
      const role = (emp.role ?? 'employee') as string
      const arr = groups.get(role) ?? []
      arr.push(emp)
      groups.set(role, arr)
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))
    }
    return Object.keys(ROLE_ORDER)
      .sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b])
      .filter(role => groups.has(role))
      .map(role => ({ role, items: groups.get(role)! }))
  })()

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <User size={12} style={{ color: 'var(--text-dim)' }} />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Ответственный</p>
        {optimisticAssignee && canManage && (
          <button
            type="button"
            onClick={() => assign(null)}
            disabled={saving}
            aria-label="Снять ответственного"
            className="ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg unassign-btn disabled:opacity-40"
          >
            <X size={11} />
            Снять
          </button>
        )}
      </div>

      <div className="space-y-3">
        {employeesByRole.map(({ role, items }) => (
          <div key={role}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-dim)' }}>
              {ROLE_LABEL[role] ?? role}
            </p>
            <div className="flex flex-wrap gap-2">
              {items.map(emp => {
                const selected = emp.id === optimisticAssignee?.id
                return (
                  <button
                    key={emp.id}
                    type="button"
                    disabled={!canManage || saving}
                    onClick={() => assign(selected ? null : emp)}
                    aria-pressed={selected}
                    className="assignee-pick flex items-center gap-2 px-2.5 py-2 rounded-xl disabled:opacity-50"
                    data-selected={selected ? 'true' : 'false'}
                    style={{ cursor: canManage ? 'pointer' : 'default' }}
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
        ))}
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
  const router = useRouter()
  const [saving, startTransition] = useTransition()
  const [optimisticDeadline, setOptimisticDeadline] = useState<string>(stage.deadline ?? '')

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOptimisticDeadline(stage.deadline ?? '') }, [stage.deadline])

  const isOverdue = optimisticDeadline && new Date(optimisticDeadline) < new Date() && stage.status !== 'completed'

  function handleChange(val: string) {
    setOptimisticDeadline(val)
    startTransition(async () => {
      const result = await updateStageDeadline(stage.id, val || null, projectId)
      if (result.error) setOptimisticDeadline(stage.deadline ?? '')
      else router.refresh()
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

