'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Plus, Search, User2, X } from 'lucide-react'
import TaskCard from '@/components/projects/board/TaskCard'
import CreateTaskSheet from '@/components/projects/board/CreateTaskSheet'
import MoveTaskSheet from '@/components/projects/board/MoveTaskSheet'
import { createClient } from '@/lib/supabase/client'
import {
  STAGE_ICONS, stageTheme,
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

export default function ProjectTasksBoard({
  stages,
  tasks,
  projectId,
  canManage,
  employees,
  userRole,
  currentUserId,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const isDirector = userRole === 'director' || userRole === 'admin'
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks)
  const [sheetStageId, setSheetStageId] = useState<string | null>(null)
  const [moveTask, setMoveTask] = useState<Task | null>(null)

  // Подхватываем свежие задачи после router.refresh() из дочерней TaskCard /
  // CreateTaskSheet / MoveTaskSheet. Без этого useState инициализируется один
  // раз из props и игнорирует апдейты от RSC.
  useEffect(() => { setLocalTasks(tasks) }, [tasks])

  // Глубокие ссылки `#task-X` — приходим из сводки /dashboard/tasks: ждём
  // первый layout-rendering сетки, потом прокручиваем к карточке и подсвечиваем
  // её на пару секунд кольцом, чтобы пользователь увидел, куда попал.
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#task-')) return
    const taskId = hash.slice('#task-'.length)
    // requestAnimationFrame даёт React успеть отрендерить grid до scroll'а.
    requestAnimationFrame(() => {
      const node = document.getElementById(`task-${taskId}`)
      if (!node) return
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      node.style.transition = 'box-shadow 1.6s ease'
      node.style.boxShadow = '0 0 0 2px color-mix(in oklab, var(--color-green) 60%, transparent)'
      setTimeout(() => { node.style.boxShadow = '' }, 1800)
    })
  }, [])

  // Скролл к этапу из ?stage=<id> (выставляется при переключении в Pipeline-view).
  // При первом маунте + при изменении параметра прокручиваем к шапке этапа
  // и подсвечиваем её на пару секунд. ScrolledRef защищает от повторного
  // скролла при обычных обновлениях стейта.
  const stageFromUrl = search.get('stage')
  const lastScrolledStageRef = useRef<string | null>(null)
  useEffect(() => {
    if (!stageFromUrl) return
    if (lastScrolledStageRef.current === stageFromUrl) return
    if (!stages.some(s => s.id === stageFromUrl)) return
    lastScrolledStageRef.current = stageFromUrl
    requestAnimationFrame(() => {
      const node = document.getElementById(`tasks-stage-${stageFromUrl}`)
      if (!node) return
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
      node.style.transition = 'box-shadow 1.6s ease'
      node.style.boxShadow = '0 0 0 2px color-mix(in oklab, var(--color-green) 60%, transparent)'
      setTimeout(() => { node.style.boxShadow = '' }, 1800)
    })
  }, [stageFromUrl, stages])

  // Realtime: подписываемся на INSERT/UPDATE/DELETE по project_tasks конкретного
  // проекта. Любое изменение тригерит router.refresh() с debounce — RSC принесёт
  // свежие props и useEffect наверху скопирует их в localTasks. Подписки на
  // project_stages здесь не нужно — этим занимается ProjectPipelineView (когда
  // открыта вкладка «Этапы»); внутри TasksBoard переименования этапа на лету
  // обновятся через следующий router.refresh().
  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    function scheduleRefresh() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 400)
    }
    const channel = supabase
      .channel(`project-tasks-${projectId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'project_tasks', filter: `project_id=eq.${projectId}` },
        scheduleRefresh,
      )
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [projectId, router])

  // ── Фильтры — храним в URL: при F5 / шейре ссылки состояние не теряется.
  // Параметры: tq (text query), ts (task status), tm (task mine).
  // Не пересекаются с другими параметрами страницы (view=, stage=).
  const query = search.get('tq') ?? ''
  const statusFilter: StatusFilter = (() => {
    const v = search.get('ts')
    return v === 'todo' || v === 'in_progress' || v === 'done' ? v : 'all'
  })()
  const onlyMine = search.get('tm') === '1'

  const updateFilter = useCallback((patch: Record<string, string | null>) => {
    const params = new URLSearchParams(search.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') params.delete(k)
      else params.set(k, v)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, search])

  const setStatusFilter = useCallback(
    (v: StatusFilter) => updateFilter({ ts: v === 'all' ? null : v }),
    [updateFilter],
  )
  const toggleMine = useCallback(() => updateFilter({ tm: onlyMine ? null : '1' }), [updateFilter, onlyMine])
  const resetFilters = useCallback(() => {
    setQLocal('')
    updateFilter({ tq: null, ts: null, tm: null })
  }, [updateFilter])

  // Локальный текстовый state для поиска — иначе каждое нажатие клавиши вызывает
  // router.replace, что заметно тормозит ввод. Синхронизация с URL — debounce 250 мс.
  const [qLocal, setQLocal] = useState(query)
  useEffect(() => { setQLocal(query) }, [query])
  useEffect(() => {
    if (qLocal === query) return
    const t = setTimeout(() => updateFilter({ tq: qLocal || null }), 250)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal])

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
        const mine = (t.assignees ?? []).some(a => a.id === currentUserId)
        if (!mine) return false
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

  const openSheetStage = sheetStageId ? stages.find(s => s.id === sheetStageId) : null
  const openSheetIdx   = sheetStageId ? stageIndexById.get(sheetStageId) ?? 0 : 0
  const openSheetTheme = stageTheme(openSheetStage?.status)

  return (
    <div className="space-y-4 w-full">
      {/* Фильтры — sticky при скролле */}
      <div
        className="sticky top-0 z-20 pt-2 pb-1"
        style={{
          background: 'linear-gradient(to bottom, var(--color-bg) 75%, transparent)',
        }}
      >
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
            value={qLocal}
            onChange={e => setQLocal(e.target.value)}
            placeholder="Поиск по названию задачи"
            className="input w-full"
            style={{ paddingLeft: 36 }}
          />
          {qLocal && (
            <button
              type="button"
              onClick={() => setQLocal('')}
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
              onClick={toggleMine}
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
      </div>

      {/* Группы по этапам */}
      <div className="space-y-4">
        {stages.map((stage, idx) => {
          const sc = stageTheme(stage.status)
          const StageIcon = STAGE_ICONS[idx % STAGE_ICONS.length]
          const stageTasks = tasksByStage.get(stage.id) ?? []
          const num = String(idx + 1).padStart(2, '0')

          // При активном фильтре пустые этапы скрываем совсем.
          const isFiltered = statusFilter !== 'all' || query.trim() !== '' || onlyMine
          if (isFiltered && stageTasks.length === 0) return null

          // Пустой этап без фильтра — одна компактная строка вместо большой плашки.
          if (stageTasks.length === 0) {
            return (
              <div
                key={stage.id}
                id={`tasks-stage-${stage.id}`}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl scroll-mt-24"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: sc.bg, color: sc.color }}
                >
                  <StageIcon size={14} />
                </div>
                <span className="num text-xs font-bold flex-shrink-0" style={{ color: sc.color + 'aa' }}>{num}</span>
                <h3 className="text-sm font-medium truncate flex-1" style={{ color: 'var(--text-muted)' }}>
                  {stage.name}
                </h3>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-dim)' }}>нет задач</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setSheetStageId(stage.id)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors hover-surface"
                    style={{ color: sc.color, border: `1px solid ${sc.color}33` }}
                    aria-label={`Добавить задачу в этап ${stage.name}`}
                  >
                    <Plus size={12} />
                    Добавить
                  </button>
                )}
              </div>
            )
          }

          return (
            <div
              key={stage.id}
              id={`tasks-stage-${stage.id}`}
              className="rounded-2xl overflow-hidden scroll-mt-24"
              style={{ background: sc.glow, border: `1px solid ${sc.color}33` }}
            >
              {/* Шапка этапа — компактная: номер, название, счётчик, кнопка «Добавить». */}
              <div
                className="flex items-center gap-3 px-4 md:px-5 py-2.5 md:py-3"
                style={{ borderBottom: `1px solid ${sc.color}22` }}
              >
                <div
                  className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: sc.bg, color: sc.color }}
                >
                  <StageIcon size={16} />
                </div>
                <span className="num text-xs font-bold flex-shrink-0" style={{ color: sc.color + 'aa' }}>{num}</span>
                <h3 className="text-sm md:text-base font-semibold truncate flex-1" style={{ color: 'var(--text)' }}>
                  {stage.name}
                </h3>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold num flex-shrink-0"
                  style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}33` }}
                >
                  {stageTasks.length}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setSheetStageId(stage.id)}
                    className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg font-medium text-xs md:text-sm flex-shrink-0 transition-colors"
                    style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}44` }}
                    aria-label={`Добавить задачу в этап ${stage.name}`}
                  >
                    <Plus size={14} />
                    <span className="hidden sm:inline">Добавить</span>
                  </button>
                )}
              </div>

              {/* Задачи */}
              <div className="px-4 md:px-5 py-3 md:py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {stageTasks.map(task => {
                    const stats = subtaskStats.get(task.id)
                    return (
                      <div key={task.id} id={`task-${task.id}`} className="scroll-mt-24">
                        <TaskCard
                          task={task}
                          canManage={canManage}
                          isDirector={isDirector}
                          projectId={projectId}
                          accentColor={sc.color}
                          currentUserId={currentUserId}
                          subtasksTotal={stats?.total}
                          subtasksDone={stats?.done}
                          onRequestMove={() => setMoveTask(task)}
                          onDeleted={() => removeTaskLocally(task.id)}
                        />
                      </div>
                    )
                  })}
                </div>
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
              onClick={resetFilters}
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
