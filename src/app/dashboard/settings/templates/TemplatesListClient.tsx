'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, MoreVertical, Star, Archive, Trash2, Edit3, Compass, Hammer,
  Briefcase, Layers, FolderOpen, Settings2, AlertCircle,
} from 'lucide-react'
import { updateTemplate, deleteTemplate } from '@/lib/actions/templates'
import CreateTemplateSheet from './CreateTemplateSheet'

export type TemplateRow = {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  is_default: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
  stages_count: number
  projects_count: number
}

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  compass:       Compass,
  hammer:        Hammer,
  briefcase:     Briefcase,
  layers:        Layers,
  'folder-open': FolderOpen,
  settings:      Settings2,
}

/** Компонент-обёртка: рендерит иконку по имени из ICONS. Вынесен в отдельный
 *  компонент, чтобы родителю не приходилось делать `const Icon = pickIcon(...)`
 *  в render — это триггерит правило react-hooks/static-components. */
function TemplateIcon({ name, size }: { name: string | null; size?: number }) {
  const Cmp = name ? (ICONS[name] ?? Compass) : Compass
  return <Cmp size={size} />
}

export default function TemplatesListClient({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const active   = templates.filter(t => !t.is_archived)
  const archived = templates.filter(t => t.is_archived)

  function refresh() {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Шапка с кнопкой создания */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          Шаблон диктует структуру этапов и чек-листов нового проекта.
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="btn-green flex items-center gap-2 text-sm"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Новый шаблон</span>
        </button>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 p-3 rounded-xl"
          style={{
            background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
            border: '1px solid color-mix(in oklab, var(--color-danger) 30%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-xs">×</button>
        </div>
      )}

      {/* Активные шаблоны */}
      {active.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-16 rounded-2xl"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <Layers size={36} className="text-text-dim opacity-40" />
          <p className="text-sm text-text-muted">Шаблонов пока нет</p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-green flex items-center gap-2 text-sm mt-2"
          >
            <Plus size={16} />
            Создать первый шаблон
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {active.map(t => (
            <TemplateCard key={t.id} t={t} onError={setError} onRefresh={refresh} />
          ))}
        </div>
      )}

      {/* Архив */}
      {archived.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-text-muted hover-text flex items-center gap-2">
            <Archive size={14} />
            <span>Архивные шаблоны ({archived.length})</span>
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 opacity-70">
            {archived.map(t => (
              <TemplateCard key={t.id} t={t} onError={setError} onRefresh={refresh} />
            ))}
          </div>
        </details>
      )}

      {createOpen && (
        <CreateTemplateSheet
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            router.push(`/dashboard/settings/templates/${id}`)
          }}
        />
      )}
    </div>
  )
}

function TemplateCard({
  t,
  onError,
  onRefresh,
}: {
  t: TemplateRow
  onError: (msg: string | null) => void
  onRefresh: () => void
}) {
  const router = useRouter()
  const color = t.color ?? '#22c55e'
  const [menuOpen, setMenuOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function setDefault() {
    setMenuOpen(false)
    startTransition(async () => {
      const r = await updateTemplate(t.id, { is_default: true })
      if (!r.ok) onError(r.error ?? 'Не удалось')
      else onRefresh()
    })
  }

  function toggleArchive() {
    setMenuOpen(false)
    startTransition(async () => {
      const r = await updateTemplate(t.id, { is_archived: !t.is_archived })
      if (!r.ok) onError(r.error ?? 'Не удалось')
      else onRefresh()
    })
  }

  function remove() {
    setMenuOpen(false)
    if (!confirm(`Удалить шаблон «${t.name}»? Действие необратимо.`)) return
    startTransition(async () => {
      const r = await deleteTemplate(t.id)
      if (!r.ok) onError(r.error ?? 'Не удалось')
      else onRefresh()
    })
  }

  return (
    <div
      className="card relative p-4 transition-colors hover-border"
      style={{
        borderColor: t.is_default ? color : 'var(--color-border)',
      }}
    >
      <button
        type="button"
        onClick={() => router.push(`/dashboard/settings/templates/${t.id}`)}
        className="absolute inset-0 z-0 rounded-[14px] cursor-pointer"
        aria-label={`Открыть шаблон ${t.name}`}
      />

      <div className="relative flex items-start gap-3 z-10 pointer-events-none">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `color-mix(in oklab, ${color} 18%, transparent)`,
            color,
            border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
          }}
        >
          <TemplateIcon name={t.icon} size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-text">{t.name}</h3>
            {t.is_default && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{
                  background: 'color-mix(in oklab, var(--color-green) 15%, transparent)',
                  color: 'var(--color-green)',
                }}
              >
                <Star size={10} />
                По умолчанию
              </span>
            )}
            {t.is_archived && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <Archive size={10} />
                Архив
              </span>
            )}
          </div>
          {t.description && (
            <p className="text-xs mt-1 text-text-muted line-clamp-2 leading-snug">{t.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-text-dim">
            <span>{t.stages_count} {pluralStages(t.stages_count)}</span>
            <span>·</span>
            <span>{t.projects_count} {pluralProjects(t.projects_count)}</span>
          </div>
        </div>

        {/* Меню действий — рендер вне pointer-events-none */}
        <div className="relative pointer-events-auto" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            disabled={pending}
            aria-label="Действия"
            className="p-1.5 rounded-lg text-text-muted hover-text hover-surface transition-colors"
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
                <Link
                  href={`/dashboard/settings/templates/${t.id}`}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover-surface"
                  style={{ color: 'var(--text)' }}
                >
                  <Edit3 size={14} />
                  Редактировать
                </Link>
                {!t.is_default && !t.is_archived && (
                  <button
                    type="button"
                    onClick={setDefault}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover-surface"
                    style={{ color: 'var(--text)' }}
                  >
                    <Star size={14} />
                    Сделать по умолчанию
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleArchive}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover-surface"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Archive size={14} />
                  {t.is_archived ? 'Вернуть из архива' : 'В архив'}
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover-surface"
                  style={{ color: 'var(--color-danger)' }}
                >
                  <Trash2 size={14} />
                  Удалить
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Plural helpers ─────────────────────────────────────────────────────────

function pluralStages(n: number): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'этап'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'этапа'
  return 'этапов'
}

function pluralProjects(n: number): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'проект'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'проекта'
  return 'проектов'
}

