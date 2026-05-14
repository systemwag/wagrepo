'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, AlertTriangle, Calendar } from 'lucide-react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, MouseSensor, TouchSensor,
  useDroppable, useSensor, useSensors, closestCorners, useDraggable,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { TransitionLink } from '@/components/ui/TransitionLink'
import { moveProjectToStageByKey } from '@/lib/actions/projects'
import { STAGE_COLORS } from '@/components/projects/board/_shared'

export type BoardColumn = {
  stage_key: string
  name: string
  order_index: number
}

export type BoardProject = {
  id: string
  name: string
  client_name: string | null
  contract_number: string | null
  deadline: string | null
  status: string
  current_stage_key: string | null
  current_stage_name: string | null
}

interface Props {
  columns: BoardColumn[]
  projects: BoardProject[]
  canMove: boolean
}

export default function ProjectsBoardClient({ columns, projects, canMove }: Props) {
  const router = useRouter()
  const [localProjects, setLocalProjects] = useState<BoardProject[]>(projects)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  // Группируем проекты по stage_key. Проекты без current_stage_key — в отдельную псевдо-колонку «Без этапа»
  const projectsByColumn = useMemo(() => {
    const m = new Map<string, BoardProject[]>()
    for (const p of localProjects) {
      const key = p.current_stage_key ?? '__unassigned'
      const arr = m.get(key) ?? []
      arr.push(p)
      m.set(key, arr)
    }
    return m
  }, [localProjects])

  const activeProject = activeId ? localProjects.find(p => p.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || !canMove) return

    const projectId = active.id as string
    const overData = over.data.current as { type?: string; stageKey?: string } | undefined
    const targetKey = overData?.stageKey
    if (!targetKey) return

    const project = localProjects.find(p => p.id === projectId)
    if (!project || project.current_stage_key === targetKey) return

    const targetColumn = columns.find(c => c.stage_key === targetKey)
    if (!targetColumn) return

    // Оптимистично переносим в локальном состоянии
    setLocalProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, current_stage_key: targetKey, current_stage_name: targetColumn.name }
        : p,
    ))

    const result = await moveProjectToStageByKey(projectId, targetKey)
    if (result.error) {
      // Откатываем при ошибке
      setLocalProjects(prev => prev.map(p =>
        p.id === projectId
          ? { ...p, current_stage_key: project.current_stage_key, current_stage_name: project.current_stage_name }
          : p,
      ))
      console.warn('[board] move failed:', result.error)
    }
    router.refresh()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Горизонтальный скролл колонок на десктопе; вертикальный стек на мобильном */}
      <div className="flex flex-col md:flex-row gap-3 md:overflow-x-auto md:pb-3 -mx-4 px-4 md:mx-0 md:px-0">
        {columns.map((column, idx) => {
          const theme = STAGE_COLORS[idx % STAGE_COLORS.length]
          const list = projectsByColumn.get(column.stage_key) ?? []
          return (
            <BoardColumnView
              key={column.stage_key}
              column={column}
              index={idx}
              themeColor={theme.color}
              themeBg={theme.bg}
              themeGlow={theme.glow}
              projects={list}
              canMove={canMove}
            />
          )
        })}

        {/* Невыделенные — если есть проекты без current_stage_key */}
        {(() => {
          const unassigned = projectsByColumn.get('__unassigned') ?? []
          if (unassigned.length === 0) return null
          return (
            <UnassignedColumn projects={unassigned} canMove={canMove} />
          )
        })()}
      </div>

      <DragOverlay>
        {activeProject ? (
          <ProjectCardCompact project={activeProject} themeColor="#22c55e" dragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Колонка доски ────────────────────────────────────────────────────────

function BoardColumnView({
  column,
  index,
  themeColor,
  themeBg,
  themeGlow,
  projects,
  canMove,
}: {
  column: BoardColumn
  index: number
  themeColor: string
  themeBg: string
  themeGlow: string
  projects: BoardProject[]
  canMove: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${column.stage_key}`,
    data: { type: 'column', stageKey: column.stage_key },
  })

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col rounded-2xl flex-shrink-0 w-full md:w-[300px] transition-colors"
      style={{
        background: isOver ? `color-mix(in oklab, ${themeColor} 12%, ${themeGlow})` : themeGlow,
        border: `1px solid ${isOver ? themeColor : `${themeColor}33`}`,
      }}
    >
      {/* Шапка колонки */}
      <div
        className="px-3 py-2.5 flex items-center gap-2 sticky top-0 z-10 rounded-t-2xl"
        style={{
          background: themeGlow,
          borderBottom: `1px solid ${themeColor}22`,
        }}
      >
        <span
          className="text-[10px] font-mono font-bold w-6 text-center"
          style={{ color: themeColor + 'aa' }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--text)' }}>
          {column.name}
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold num"
          style={{ background: themeBg, color: themeColor, border: `1px solid ${themeColor}33` }}
        >
          {projects.length}
        </span>
      </div>

      {/* Карточки проектов */}
      <div className="flex flex-col gap-2 p-2 min-h-[80px]">
        {projects.length === 0 ? (
          <div
            className="text-xs text-text-dim text-center py-6 rounded-lg"
            style={{ border: `1px dashed ${themeColor}33` }}
          >
            Пусто
          </div>
        ) : (
          projects.map(p => (
            <ProjectCardCompact
              key={p.id}
              project={p}
              themeColor={themeColor}
              draggable={canMove}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Колонка для проектов без current_stage_key ───────────────────────────

function UnassignedColumn({
  projects,
  canMove,
}: {
  projects: BoardProject[]
  canMove: boolean
}) {
  return (
    <div
      className="flex flex-col rounded-2xl flex-shrink-0 w-full md:w-[280px]"
      style={{
        background: 'var(--color-surface)',
        border: '1px dashed var(--color-border-2)',
      }}
    >
      <div
        className="px-3 py-2.5 flex items-center gap-2 sticky top-0 z-10 rounded-t-2xl"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <h3 className="text-sm font-semibold flex-1" style={{ color: 'var(--text-muted)' }}>
          Без этапа
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold num"
          style={{ background: 'var(--color-surface-2)', color: 'var(--text-muted)' }}
        >
          {projects.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {projects.map(p => (
          <ProjectCardCompact key={p.id} project={p} themeColor="#7a9e8a" draggable={canMove} />
        ))}
      </div>
    </div>
  )
}

// ─── Компактная карточка проекта (для канбана) ────────────────────────────

function ProjectCardCompact({
  project,
  themeColor,
  draggable = false,
  dragging = false,
}: {
  project: BoardProject
  themeColor: string
  draggable?: boolean
  dragging?: boolean
}) {
  const sortable = useDraggable({
    id: project.id,
    disabled: !draggable,
    data: { type: 'project', projectId: project.id },
  })
  const { attributes, listeners, setNodeRef, isDragging } = sortable

  const isOverdue = project.deadline && new Date(project.deadline) < new Date()
  const formattedDeadline = project.deadline
    ? new Date(project.deadline).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', day: '2-digit', month: '2-digit' })
    : null

  return (
    <div
      ref={setNodeRef}
      className="group rounded-xl p-3 transition-colors"
      style={{
        background: dragging
          ? 'var(--color-surface)'
          : 'var(--color-surface)',
        border: `1px solid ${dragging ? themeColor : 'var(--color-border)'}`,
        boxShadow: dragging
          ? `0 8px 24px ${themeColor}30`
          : '0 1px 3px rgba(0,0,0,0.1)',
        opacity: isDragging ? 0.35 : 1,
        cursor: draggable ? 'grab' : 'default',
        touchAction: draggable ? 'none' : 'auto',
      }}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <TransitionLink
            href={`/dashboard/projects/${project.id}`}
            onClick={e => e.stopPropagation()}
            className="text-sm font-semibold leading-snug block truncate hover-text"
            style={{ color: 'var(--text)' }}
          >
            {project.name}
          </TransitionLink>
          {project.client_name && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {project.client_name}
            </p>
          )}
        </div>
        <ChevronRight size={14} className="shrink-0 text-text-dim mt-0.5" />
      </div>

      <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
        {formattedDeadline && (
          <span
            className="inline-flex items-center gap-1 num"
            style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
          >
            {isOverdue ? <AlertTriangle size={11} /> : <Calendar size={11} />}
            {formattedDeadline}
          </span>
        )}
        {project.contract_number && (
          <span className="num truncate" style={{ color: 'var(--color-text-dim)' }}>
            № {project.contract_number}
          </span>
        )}
      </div>
    </div>
  )
}
