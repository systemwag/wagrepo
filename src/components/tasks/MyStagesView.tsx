'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { DesignStage, StageDocument, StageStatus, ReviewStatus } from '@/lib/constants/design-stages'
import { REVIEW_STATUS_LABEL } from '@/lib/constants/design-stages'
import { updateStageStatus, deleteStageDocument } from '@/lib/actions/stages'
import { toggleChecklistItem } from '@/lib/actions/checklist'
import { createClient } from '@/lib/supabase/client'
import StageStatusBadge from '@/components/planning/StageStatusBadge'
import {
  ChevronDown, ChevronUp, Check, Clock, Loader2, Lock,
  AlertTriangle, Calendar, CheckSquare, Paperclip, FileText,
  FileImage, File, Plus, X, ShieldCheck, RotateCcw,
  ClipboardList, ExternalLink, Layers, FolderOpen,
} from 'lucide-react'

const STAGE_COLORS = [
  { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  glow: 'rgba(59,130,246,0.06)'  },
  { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  glow: 'rgba(16,185,129,0.06)'  },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  glow: 'rgba(245,158,11,0.06)'  },
  { color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  glow: 'rgba(168,85,247,0.06)'  },
  { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   glow: 'rgba(6,182,212,0.06)'   },
  { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  glow: 'rgba(249,115,22,0.06)'  },
  { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   glow: 'rgba(244,63,94,0.06)'   },
  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   glow: 'rgba(34,197,94,0.06)'   },
]

export type Task = {
  id: string
  title: string
  description: string | null
  employee_note: string | null
  status: string
  priority: string
  deadline: string | null
  project: { id: string; name: string } | null
  creator: { full_name: string } | null
}

export type StageWithProject = DesignStage & {
  project: { id: string; name: string; status: string; deadline: string | null } | null
}

type Props = {
  stages: StageWithProject[]
  tasks: Task[]
  userRole: string
}


const STATUS_CONFIG: { value: StageStatus; label: string; icon: React.ReactNode; bg: string; color: string; border: string }[] = [
  { value: 'pending',     label: 'Ожидание',     icon: <Clock size={13} />,    bg: 'var(--surface-2)',       color: 'var(--text-muted)', border: 'var(--border-2)' },
  { value: 'in_progress', label: 'В работе',     icon: <Loader2 size={13} />,  bg: 'rgba(59,130,246,0.1)',   color: '#60a5fa',           border: 'rgba(59,130,246,0.25)' },
  { value: 'completed',   label: 'Завершён',     icon: <Check size={13} />,    bg: 'var(--green-glow)',      color: 'var(--green)',      border: 'rgba(34,197,94,0.25)' },
  { value: 'blocked',     label: 'Заблокирован', icon: <Lock size={13} />,     bg: 'rgba(239,68,68,0.1)',    color: '#f87171',           border: 'rgba(239,68,68,0.25)' },
]

const REVIEW_CONFIG: { value: ReviewStatus; label: string; icon: React.ReactNode; bg: string; color: string; border: string }[] = [
  { value: 'pending_review',  label: 'На проверке',  icon: <Clock size={13} />,       bg: 'rgba(234,179,8,0.1)',  color: '#ca8a04', border: 'rgba(234,179,8,0.25)' },
  { value: 'approved',        label: 'Одобрено',     icon: <ShieldCheck size={13} />, bg: 'var(--green-glow)',    color: 'var(--green)', border: 'rgba(34,197,94,0.25)' },
  { value: 'revision_needed', label: 'На доработку', icon: <RotateCcw size={13} />,   bg: 'rgba(249,115,22,0.1)', color: '#fb923c', border: 'rgba(249,115,22,0.25)' },
]


function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

function getMimeIcon(mime: string | null) {
  if (mime === 'application/pdf') return <FileText size={15} style={{ color: '#f87171' }} />
  if (mime?.startsWith('image/')) return <FileImage size={15} style={{ color: '#60a5fa' }} />
  return <File size={15} style={{ color: 'var(--text-dim)' }} />
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span style={{ color: 'var(--text-dim)' }}>{icon}</span>
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{title}</h2>
      {count !== undefined && (
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-dim)' }}>
          {count}
        </span>
      )}
    </div>
  )
}

// ─── Главный компонент ───────────────────────────────────────────────────────
export default function MyStagesView({ stages, tasks, userRole }: Props) {
  const today = new Date()

  const overdueStages  = stages.filter(s => s.deadline && new Date(s.deadline) < today && s.status !== 'completed')
  const activeStages   = stages.filter(s => s.status !== 'completed' && !(s.deadline && new Date(s.deadline) < today))
  const doneStages     = stages.filter(s => s.status === 'completed')

  const [expandedId, setExpandedId] = useState<string | null>(
    overdueStages[0]?.id ?? stages.find(s => s.status === 'in_progress')?.id ?? stages[0]?.id ?? null
  )

  if (stages.length === 0 && tasks.length === 0) {
    return (
      <div className="card py-20 text-center">
        <Layers size={36} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
        <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Нет задач по проектам</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Руководитель ещё не назначил вам этапы или задачи</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Просроченные ─── */}
      {overdueStages.length > 0 && (
        <div>
          <SectionHeader
            icon={<AlertTriangle size={14} style={{ color: '#f87171' }} />}
            title="Просрочено"
            count={overdueStages.length}
          />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {overdueStages.map(stage => (
              <StageCard
                key={stage.id}
                stage={stage}
                isExpanded={expandedId === stage.id}
                onToggle={() => setExpandedId(p => p === stage.id ? null : stage.id)}
                colorIdx={stage.order_index % STAGE_COLORS.length}
                overdue
                userRole={userRole}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Активные этапы ─── */}
      {activeStages.length > 0 && (
        <div>
          <SectionHeader icon={<Layers size={14} />} title="Мои этапы" count={activeStages.length} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {activeStages.map(stage => (
              <StageCard
                key={stage.id}
                stage={stage}
                isExpanded={expandedId === stage.id}
                onToggle={() => setExpandedId(p => p === stage.id ? null : stage.id)}
                colorIdx={stage.order_index % STAGE_COLORS.length}
                userRole={userRole}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Задачи по проектам ─── */}
      <ProjectTasksSection tasks={tasks} today={today} />

      {/* ── Завершённые этапы ─── */}
      {doneStages.length > 0 && (
        <div>
          <SectionHeader icon={<Check size={14} />} title="Завершённые этапы" count={doneStages.length} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {doneStages.map(stage => (
              <StageCard
                key={stage.id}
                stage={stage}
                isExpanded={expandedId === stage.id}
                onToggle={() => setExpandedId(p => p === stage.id ? null : stage.id)}
                colorIdx={stage.order_index % STAGE_COLORS.length}
                userRole={userRole}
                done
              />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Карточка этапа ──────────────────────────────────────────────────────────
function StageCard({
  stage,
  isExpanded,
  onToggle,
  userRole: _userRole,
  colorIdx = 0,
  overdue,
  done,
}: {
  stage: StageWithProject
  isExpanded: boolean
  onToggle: () => void
  userRole: string
  colorIdx?: number
  overdue?: boolean
  done?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useState<StageStatus>(stage.status)

  const completedItems = stage.checklist_items.filter(i => i.is_completed).length
  const totalItems     = stage.checklist_items.length
  const checklistPct   = totalItems ? Math.round((completedItems / totalItems) * 100) : 0
  const sc             = STAGE_COLORS[colorIdx % STAGE_COLORS.length]
  const accentColor    = overdue ? '#f87171' : optimisticStatus === 'blocked' ? '#f87171' : sc.color
  const reviewCfg      = REVIEW_CONFIG.find(c => c.value === stage.review_status)

  function handleStatusChange(newStatus: StageStatus) {
    if (newStatus === optimisticStatus) return
    setOptimisticStatus(newStatus)
    startTransition(async () => {
      const result = await updateStageStatus(stage.id, newStatus, stage.project_id)
      if (result.error) setOptimisticStatus(stage.status)
    })
  }

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: isExpanded ? 'var(--surface)' : sc.glow,
        border: `1px solid ${isExpanded ? accentColor + '66' : accentColor + '33'}`,
        boxShadow: isExpanded ? `0 0 0 1px ${accentColor}22, 0 4px 24px ${accentColor}10` : 'none',
      }}
    >
      <div className="flex">
        {/* Левый акцент — всегда видимый */}
        <div
          className="w-1 flex-shrink-0 rounded-l-2xl transition-all"
          style={{ background: isExpanded ? accentColor : accentColor + '66' }}
        />

        <div className="flex-1 min-w-0">
          {/* Заголовок */}
          <button
            onClick={onToggle}
            className="w-full flex items-center gap-4 px-4 py-4 text-left transition-colors"
            onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = `${accentColor}08` }}
            onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {/* Статус-иконка */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: optimisticStatus === 'completed' ? 'var(--green-glow)' : sc.bg,
                color: optimisticStatus === 'completed' ? 'var(--green)' : overdue ? '#f87171' : sc.color,
                border: `2px solid ${accentColor}44`,
                boxShadow: isExpanded ? `0 0 16px ${accentColor}33` : 'none',
              }}
            >
              {optimisticStatus === 'completed' ? <Check size={20} strokeWidth={2.5} /> :
               optimisticStatus === 'blocked'   ? <Lock size={17} /> :
               overdue                          ? <AlertTriangle size={17} /> :
                                                  <Layers size={17} />}
            </div>

            {/* Инфо */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg leading-tight" style={{
                  color: done ? 'var(--text-muted)' : 'var(--text)',
                  textDecoration: done ? 'line-through' : 'none',
                }}>
                  {stage.name}
                </span>
                <StageStatusBadge status={optimisticStatus} />
                {reviewCfg && (
                  <span
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: reviewCfg.bg, color: reviewCfg.color, border: `1px solid ${reviewCfg.border}` }}
                  >
                    {reviewCfg.icon}
                    {REVIEW_STATUS_LABEL[stage.review_status!]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {stage.project && (
                  <span className="text-sm font-medium" style={{ color: accentColor + 'cc' }}>{stage.project.name}</span>
                )}
                {stage.deadline && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: overdue ? '#f87171' : 'var(--text-dim)' }}>
                    {overdue ? <AlertTriangle size={11} /> : <Calendar size={11} />}
                    {new Date(stage.deadline).toLocaleDateString('ru-RU')}
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

            {/* Прогресс + шеврон */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {totalItems > 0 && (
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-semibold" style={{ color: checklistPct === 100 ? 'var(--green)' : accentColor }}>
                    {checklistPct}%
                  </span>
                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-2)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${checklistPct}%`, background: checklistPct === 100 ? 'var(--green)' : accentColor }}
                    />
                  </div>
                </div>
              )}
              {isExpanded
                ? <ChevronUp size={18} style={{ color: accentColor }} />
                : <ChevronDown size={18} style={{ color: 'var(--text-dim)' }} />
              }
            </div>
          </button>

          {/* Раскрытое тело */}
          {isExpanded && (
            <div className="px-4 pb-5">
              <div
                className="h-px mb-5"
                style={{ background: `linear-gradient(to right, ${accentColor}44, transparent)` }}
              />
              <div className="ml-[64px] space-y-5">

                {/* Ссылка на проект */}
                {stage.project && (
                  <a
                    href={`/dashboard/projects/${stage.project.id}`}
                    className="flex items-center gap-2 text-sm transition-colors w-fit"
                    style={{ color: 'var(--green)' }}
                  >
                    <ExternalLink size={13} />
                    Перейти к проекту «{stage.project.name}»
                  </a>
                )}

                {/* Статус */}
                <StatusSelector current={optimisticStatus} disabled={pending} onChange={handleStatusChange} />

                {/* Чек-лист */}
                {stage.checklist_items.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardList size={13} style={{ color: 'var(--text-dim)' }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
                        Чек-лист
                      </span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>
                        {completedItems}/{totalItems}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {stage.checklist_items.map(item => (
                        <ChecklistRow key={item.id} item={item} projectId={stage.project_id} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Заметки (read-only) */}
                {stage.notes && (
                  <p
                    className="text-sm px-3.5 py-2.5 rounded-xl"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    {stage.notes}
                  </p>
                )}

                {/* Документы */}
                <DocumentsPanel stage={stage} projectId={stage.project_id} />

                {/* Проверка руководителя (read-only для сотрудника) */}
                <ReviewStatusDisplay reviewStatus={stage.review_status} reviewedAt={stage.reviewed_at} />

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Статус-селектор ─────────────────────────────────────────────────────────
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
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: 'var(--text-dim)' }}><Clock size={13} /></span>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          Статус этапа
        </span>
      </div>
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
    </div>
  )
}

// ─── Чек-лист строка ─────────────────────────────────────────────────────────
function ChecklistRow({
  item,
  projectId,
}: {
  item: DesignStage['checklist_items'][number]
  projectId: string
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
    <button
      onClick={handleToggle}
      disabled={pending}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors disabled:opacity-60"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      <div
        className="flex-shrink-0 rounded-md flex items-center justify-center transition-all"
        style={{
          width: '18px', height: '18px',
          background: optimisticDone ? 'var(--green)' : 'transparent',
          border: `2px solid ${optimisticDone ? 'var(--green)' : 'var(--border-2)'}`,
        }}
      >
        {optimisticDone && <Check size={11} color="#040d07" strokeWidth={3} />}
      </div>
      <span
        className="text-sm flex-1"
        style={{
          color: optimisticDone ? 'var(--text-dim)' : 'var(--text-muted)',
          textDecoration: optimisticDone ? 'line-through' : 'none',
        }}
      >
        {item.label}
        {item.is_required && !optimisticDone && <span className="ml-1 text-xs" style={{ color: '#f87171' }}>*</span>}
      </span>
      {pending && <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: 'var(--text-dim)' }} />}
    </button>
  )
}

// ─── Статус проверки руководителя (read-only) ────────────────────────────────
function ReviewStatusDisplay({
  reviewStatus,
  reviewedAt,
}: {
  reviewStatus: ReviewStatus | null
  reviewedAt: string | null
}) {
  const cfg = REVIEW_CONFIG.find(c => c.value === reviewStatus)

  return (
    <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-2)', border: `1px solid ${cfg?.border ?? 'var(--border)'}` }}>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={13} style={{ color: 'var(--text-dim)' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          Проверка руководителя
        </span>
      </div>
      {cfg ? (
        <div className="flex items-center gap-3 mt-2">
          <span
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-medium"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            {cfg.icon}
            {REVIEW_STATUS_LABEL[reviewStatus!]}
          </span>
          {reviewedAt && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {new Date(reviewedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Ожидается проверка руководителя</p>
      )}
    </div>
  )
}

// ─── Документы (загрузка + просмотр) ─────────────────────────────────────────
const BUCKET = 'project-files'
const ALLOWED_TYPES = '.pdf,.jpg,.jpeg,.png'

function DocumentsPanel({
  stage,
  projectId,
}: {
  stage: StageWithProject
  projectId: string
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

    const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })

    if (storageError) {
      setUploadError(storageError.message)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        stage_id:   stage.id,
        name:       file.name,
        file_path:  path,
        file_size:  file.size,
        mime_type:  file.type,
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
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Paperclip size={13} style={{ color: 'var(--text-dim)' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          Документы
        </span>
        {docs.length > 0 && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>{docs.length}</span>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {uploadError && (
          <div className="px-3 py-2 flex items-center gap-2 text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', borderBottom: '1px solid var(--border)' }}>
            <AlertTriangle size={13} />
            {uploadError}
          </div>
        )}

        {docs.length > 0 && (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 group">
                <span className="flex-shrink-0">{getMimeIcon(doc.mime_type)}</span>
                <button onClick={() => handleOpen(doc)} className="flex-1 text-left min-w-0">
                  <p
                    className="text-sm font-medium truncate transition-colors"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--green)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
                  >
                    {doc.name}
                  </p>
                  {doc.file_size && <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatBytes(doc.file_size)}</p>}
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40 p-1 rounded-lg"
                  style={{ color: 'var(--text-dim)' }}
                  onMouseEnter={e => { ;(e.currentTarget as HTMLElement).style.color = '#f87171'; ;(e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)' }}
                  onMouseLeave={e => { ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; ;(e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {deletingId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}

        {docs.length === 0 && !uploading && (
          <div className="px-3 py-4 flex items-center gap-2 justify-center">
            <Paperclip size={13} style={{ color: 'var(--text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Нет прикреплённых файлов</p>
          </div>
        )}

        <div style={{ borderTop: docs.length > 0 || uploadError ? '1px solid var(--border)' : 'none' }}>
          <label
            className="flex items-center justify-center gap-2 text-sm px-3 py-2.5 cursor-pointer transition-colors"
            style={{ color: uploading ? 'var(--text-dim)' : 'var(--green)', background: 'var(--surface-2)' }}
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
      </div>
    </div>
  )
}

// ─── Задачи по проектам ───────────────────────────────────────────────────────
function ProjectTasksSection({ tasks, today }: { tasks: Task[]; today: Date }) {
  if (tasks.length === 0) return null

  // Сгруппировать по проекту
  const byProject = new Map<string, { name: string; tasks: Task[] }>()
  for (const task of tasks) {
    if (!task.project) continue
    const key = task.project.id
    if (!byProject.has(key)) byProject.set(key, { name: task.project.name, tasks: [] })
    byProject.get(key)!.tasks.push(task)
  }
  const groups = Array.from(byProject.entries())

  const PROJECT_COLORS = [
    { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)'  },
    { color: '#10b981', bg: 'rgba(16,185,129,0.08)'  },
    { color: '#a855f7', bg: 'rgba(168,85,247,0.08)'  },
    { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)'   },
    { color: '#f97316', bg: 'rgba(249,115,22,0.08)'  },
    { color: '#f43f5e', bg: 'rgba(244,63,94,0.08)'   },
  ]

  return (
    <div>
      <SectionHeader
        icon={<FolderOpen size={14} style={{ color: '#60a5fa' }} />}
        title="Задачи по проектам"
        count={tasks.length}
      />
      <div className="space-y-4">
        {groups.map(([projectId, group], gIdx) => {
          const pc = PROJECT_COLORS[gIdx % PROJECT_COLORS.length]
          return (
            <div
              key={projectId}
              className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${pc.color}22`, background: pc.bg }}
            >
              {/* Заголовок проекта */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: `1px solid ${pc.color}18` }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${pc.color}20`, color: pc.color }}>
                  <FolderOpen size={15} />
                </div>
                <a
                  href={`/dashboard/projects/${projectId}`}
                  className="text-base font-semibold flex-1 transition-colors"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = pc.color}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
                >
                  {group.name}
                </a>
                <span className="text-sm px-2.5 py-0.5 rounded-full font-medium"
                  style={{ background: `${pc.color}18`, color: pc.color }}>
                  {group.tasks.length}
                </span>
              </div>

              {/* Список задач */}
              <div className="divide-y" style={{ borderColor: `${pc.color}12` }}>
                {group.tasks.map(task => (
                  <ProjectTaskRow key={task.id} task={task} accentColor={pc.color} today={today} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProjectTaskRow({ task, accentColor, today }: { task: Task; accentColor: string; today: Date }) {
  const isOverdue = task.deadline && new Date(task.deadline) < today
  const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    todo:        { color: 'var(--text-muted)', bg: 'var(--surface-2)',     label: 'К выполнению' },
    in_progress: { color: '#60a5fa',           bg: 'rgba(59,130,246,0.1)',label: 'В работе'     },
    review:      { color: '#ca8a04',           bg: 'rgba(234,179,8,0.1)', label: 'На проверке'  },
    done:        { color: 'var(--green)',       bg: 'var(--green-glow)',   label: 'Готово'       },
  }
  const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
    low:      { color: 'var(--text-dim)',  label: 'Низкий'    },
    medium:   { color: '#60a5fa',          label: 'Средний'   },
    high:     { color: '#fb923c',          label: 'Высокий'   },
    critical: { color: '#f87171',          label: 'Критичный' },
  }
  const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo
  const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium

  return (
    <div className="flex items-center gap-4 px-4 py-3 transition-colors"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${accentColor}08`}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      {/* Статус-точка */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc.color }} />

      {/* Название */}
      <p className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--text)' }}>
        {task.title}
      </p>

      {/* Мета */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs font-medium" style={{ color: pc.color }}>{pc.label}</span>
        {task.deadline && (
          <span className="flex items-center gap-1 text-xs" style={{ color: isOverdue ? '#f87171' : 'var(--text-dim)' }}>
            {isOverdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}
            {new Date(task.deadline).toLocaleDateString('ru-RU')}
          </span>
        )}
        <span className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: sc.bg, color: sc.color }}>
          {sc.label}
        </span>
      </div>
    </div>
  )
}
