'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setStageAssignees } from '@/lib/actions/assignees'
import { CheckSquare, Plus, Search, User2, X } from 'lucide-react'
import TaskCard from '@/components/projects/board/TaskCard'
import StageAssignee from '@/components/projects/board/StageAssignee'
import CreateTaskSheet from '@/components/projects/board/CreateTaskSheet'
import MoveTaskSheet from '@/components/projects/board/MoveTaskSheet'
import {
  STAGE_COLORS, STAGE_ICONS,
  type Employee, type Stage, type Task,
} from '@/components/projects/board/_shared'

type Props = {
  stages: Stage[]
  tasks: Task[]
  projectId: string
  canManage: boolean
  employees: Employee[]
  userRole?: string
  currentUserId?: string
}

type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done'

const PRIORITY_RANK: Record<string, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
}

function sortTasks(a: Task, b: Task): number {
  // Done — всегда в конце
  const aDone = a.status === 'done' ? 1 : 0
  const bDone = b.status === 'done' ? 1 : 0
  if (aDone !== bDone) return aDone - bDone
  // По приоритету (высокий выше)
  const ap = PRIORITY_RANK[a.priority] ?? 0
  const bp = PRIORITY_RANK[b.priority] ?? 0
  if (ap !== bp) return bp - ap
  // По дедлайну (ранний выше)
  if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
  if (a.deadline) return -1
  if (b.deadline) return 1
  return 0
}

export default function KanbanBoard({
  stages,
  tasks,
  projectId,
  canManage,
  employees,
  userRole,
  currentUserId,
}: Props) {
  const router = useRouter()
  const isDirector = userRole === 'director' || userRole === 'admin'
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks)
  const [sheetStageId, setSheetStageId] = useState<string | null>(null)
  const [moveTask, setMoveTask] = useState<Task | null>(null)

  // ── Фильтры ───────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [onlyMine, setOnlyMine] = useState(false)

  const stageIndexById = useMemo(() => {
    const m = new Map<string, number>()
    stages.forEach((s, idx) => m.set(s.id, idx))
    return m
  }, [stages])

  // Подсчёт подзадач у каждой родительской
  const subtaskStats = useMemo(() => {
    const stats = new Map<string, { total: number; done: number }>()
    for (const t of localTasks) {
      if (!t.parent_task_id) continue
      const s = stats.get(t.parent_task_id) ?? { total: 0, done: 0 }
      s.total += 1
      if (t.status === 'done') s.done += 1
      stats.set(t.parent_task_id, s)
    }
    return stats
  }, [localTasks])

  // Применяем фильтры — top-level задачи только
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return localTasks.filter(t => {
      if (t.parent_task_id) return false
      if (q && !t.title.toLowerCase().includes(q)) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (onlyMine && currentUserId) {
        // Сравниваем с full_name?.id — у нас в Task нет assignee_id напрямую,
        // assignee — это только { full_name }. Используем косвенный признак
        // через assignee_id (если приходит из DB как часть Task расширения).
        // Пока без поддержки — отметим это TODO в будущем расширении типа.
        return true
      }
      return true
    })
  }, [localTasks, query, statusFilter, onlyMine, currentUserId])

  // Группируем отфильтрованные задачи по этапам
  const tasksByStage = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of filtered) {
      if (!t.stage_id) continue
      const arr = m.get(t.stage_id) ?? []
      arr.push(t)
      m.set(t.stage_id, arr)
    }
    for (const arr of m.values()) arr.sort(sortTasks)
    return m
  }, [filtered])

  const totalShown = filtered.length

  function removeTaskLocally(taskId: string) {
    setLocalTasks(prev => prev.filter(t => t.id !== taskId))
  }

  async function saveStageAssignees(stageId: string, profileIds: string[]) {
    await setStageAssignees(stageId, profileIds, projectId)
    router.refresh()
  }

  const openSheetStage = sheetStageId ? stages.find(s => s.id === sheetStageId) : null
  const openSheetIdx   = sheetStageId ? stageIndexById.get(sheetStageId) ?? 0 : 0
  const openSheetTheme = STAGE_COLORS[openSheetIdx % STAGE_COLORS.length]

  return (
    <div className="space-y-4">
      {/* Фильтры */}
      <div
        className="flex flex-col gap-3 p-3 rounded-2xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Поиск */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по названию задачи"
            className="input w-full"
            style={{ paddingLeft: 36 }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Очистить"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover-text"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Chips статуса + toggle "только мои" */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip label="Все"        value="all"         current={statusFilter} onChange={setStatusFilter} />
          <StatusChip label="В работе"   value="in_progress" current={statusFilter} onChange={setStatusFilter} />
          <StatusChip label="К работе"   value="todo"        current={statusFilter} onChange={setStatusFilter} />
          <StatusChip label="Выполнено"  value="done"        current={statusFilter} onChange={setStatusFilter} />

          {currentUserId && (
            <button
              type="button"
              onClick={() => setOnlyMine(o => !o)}
              className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              style={{
                background: onlyMine ? 'color-mix(in oklab, var(--color-green) 15%, transparent)' : 'var(--color-surface-2)',
                color: onlyMine ? 'var(--color-green)' : 'var(--color-text-muted)',
                border: `1px solid ${onlyMine ? 'color-mix(in oklab, var(--color-green) 30%, transparent)' : 'var(--color-border)'}`,
              }}
            >
              <User2 size={12} />
              Только мои
            </button>
          )}
        </div>

        <p className="text-xs text-text-dim">
          Найдено задач: <span className="num font-medium" style={{ color: 'var(--text-muted)' }}>{totalShown}</span>
        </p>
      </div>

      {/* Группы по этапам */}
      <div className="space-y-5">
        {stages.map((stage, idx) => {
          const sc = STAGE_COLORS[idx % STAGE_COLORS.length]
          const StageIcon = STAGE_ICONS[idx % STAGE_ICONS.length]
          const stageTasks = tasksByStage.get(stage.id) ?? []
          const checklistItems = stage.checklist_items ?? []
          const doneItems = checklistItems.filter(i => i.is_completed).length
          const checklistPct = checklistItems.length ? Math.round((doneItems / checklistItems.length) * 100) : 0
          const num = String(idx + 1).padStart(2, '0')

          // Если фильтры применены и у этапа нет задач — сворачиваем (показываем компакт)
          const isFiltered = statusFilter !== 'all' || query.trim() !== '' || onlyMine
          const hideEmpty = isFiltered && stageTasks.length === 0
          if (hideEmpty) return null

          return (
            <div
              key={stage.id}
              className="rounded-2xl overflow-hidden"
              style={{ background: sc.glow, border: `1px solid ${sc.color}33` }}
            >
              {/* Шапка этапа */}
              <div
                className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-4 flex-wrap"
                style={{ borderBottom: `1px solid ${sc.color}22` }}
              >
                <div
                  className="w-11 h-11 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: sc.bg, color: sc.color, border: `2px solid ${sc.color}44` }}
                >
                  <StageIcon size={20} className="md:hidden" />
                  <StageIcon size={24} className="hidden md:block" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 md:gap-3 flex-wrap mb-1">
                    <span className="text-xs font-mono font-bold" style={{ color: sc.color + 'aa' }}>{num}</span>
                    <h3 className="text-base md:text-xl font-bold truncate" style={{ color: 'var(--text)' }}>{stage.name}</h3>
                    <span
                      className="text-xs md:text-sm px-2 py-0.5 rounded-full font-semibold num"
                      style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}33` }}
                    >
                      {stageTasks.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                    {checklistItems.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-20 md:w-28 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-2)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${checklistPct}%`,
                              background: checklistPct === 100 ? 'var(--green)' : sc.color,
                            }}
                          />
                        </div>
                        <span className="text-xs md:text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <CheckSquare size={12} style={{ color: sc.color }} />
                          {doneItems}/{checklistItems.length}
                        </span>
                      </div>
                    )}

                    <StageAssignee
                      stage={stage}
                      employees={employees}
                      canManage={canManage}
                      stageColor={sc.color}
                      onSave={saveStageAssignees}
                    />
                  </div>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => setSheetStageId(stage.id)}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-semibold text-sm flex-shrink-0 transition-all"
                    style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}44` }}
                    aria-label={`Добавить задачу в этап ${stage.name}`}
                  >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Добавить</span>
                  </button>
                )}
              </div>

              {/* Задачи */}
              <div className="px-4 md:px-5 py-3 md:py-4">
                {stageTasks.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {stageTasks.map(task => {
                      const stats = subtaskStats.get(task.id)
                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          canManage={canManage}
                          isDirector={isDirector}
                          projectId={projectId}
                          accentColor={sc.color}
                          subtasksTotal={stats?.total}
                          subtasksDone={stats?.done}
                          onRequestMove={() => setMoveTask(task)}
                          onDeleted={() => removeTaskLocally(task.id)}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div
                    className="rounded-xl py-6 md:py-8 flex flex-col items-center gap-2"
                    style={{ border: `2px dashed ${sc.color}33` }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: sc.bg, color: sc.color }}
                    >
                      <StageIcon size={18} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>Нет задач</p>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setSheetStageId(stage.id)}
                        className="text-sm px-3 py-1.5 rounded-lg transition-colors"
                        style={{ color: sc.color }}
                      >
                        + Добавить задачу
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {totalShown === 0 && (statusFilter !== 'all' || query.trim() !== '' || onlyMine) && (
          <div
            className="rounded-2xl py-12 flex flex-col items-center gap-2"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <p className="text-sm text-text-muted">По заданным фильтрам ничего не нашлось</p>
            <button
              type="button"
              onClick={() => { setQuery(''); setStatusFilter('all'); setOnlyMine(false) }}
              className="text-sm text-text-muted hover-text"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>

      {/* Sheets */}
      {openSheetStage && (
        <CreateTaskSheet
          stage={openSheetStage}
          stageColor={openSheetTheme.color}
          stageIndex={openSheetIdx}
          employees={employees}
          projectId={projectId}
          onClose={() => setSheetStageId(null)}
          onCreated={() => {
            setSheetStageId(null)
            router.refresh()
          }}
        />
      )}

      {moveTask && (
        <MoveTaskSheet
          taskId={moveTask.id}
          taskTitle={moveTask.title}
          currentStageId={moveTask.stage_id}
          stages={stages}
          projectId={projectId}
          onClose={() => setMoveTask(null)}
          onMoved={() => {
            setMoveTask(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function StatusChip({
  label,
  value,
  current,
  onChange,
}: {
  label: string
  value: StatusFilter
  current: StatusFilter
  onChange: (v: StatusFilter) => void
}) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
      style={{
        background: active ? 'color-mix(in oklab, var(--color-green) 15%, transparent)' : 'var(--color-surface-2)',
        color: active ? 'var(--color-green)' : 'var(--color-text-muted)',
        border: `1px solid ${active ? 'color-mix(in oklab, var(--color-green) 30%, transparent)' : 'var(--color-border)'}`,
      }}
    >
      {label}
    </button>
  )
}
