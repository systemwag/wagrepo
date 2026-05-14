'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X, AlertCircle, GripVertical,
} from 'lucide-react'
import {
  addTemplateStage,
  updateTemplateStage,
  deleteTemplateStage,
  reorderTemplateStages,
  addTemplateChecklistItem,
  updateTemplateChecklistItem,
  deleteTemplateChecklistItem,
  type TemplateWithStages,
} from '@/lib/actions/templates'

type Stage = TemplateWithStages['stages'][number]

export default function TemplateEditorClient({ template }: { template: TemplateWithStages }) {
  const router = useRouter()
  const [stages, setStages] = useState<Stage[]>(template.stages)
  const [error, setError] = useState<string | null>(null)
  const [newStageName, setNewStageName] = useState('')
  const [, startTransition] = useTransition()

  function refresh() {
    router.refresh()
  }

  // ── Добавить этап ─────────────────────────────────────────────────────
  async function addStage() {
    if (!newStageName.trim()) return
    const name = newStageName.trim()
    setNewStageName('')
    const r = await addTemplateStage(template.id, { name })
    if (!r.ok) {
      setError(r.error ?? 'Не удалось')
      setNewStageName(name)
    } else {
      refresh()
    }
  }

  // ── Удалить этап ───────────────────────────────────────────────────────
  async function deleteStage(stageId: string) {
    if (!confirm('Удалить этап и все его пункты чек-листа?')) return
    // Оптимистично
    setStages(prev => prev.filter(s => s.id !== stageId))
    const r = await deleteTemplateStage(stageId, template.id)
    if (!r.ok) {
      setError(r.error ?? 'Не удалось')
      refresh()
    }
  }

  // ── Изменить порядок этапа ────────────────────────────────────────────
  function moveStage(stageId: string, direction: -1 | 1) {
    const idx = stages.findIndex(s => s.id === stageId)
    if (idx < 0) return
    const target = idx + direction
    if (target < 0 || target >= stages.length) return

    const next = stages.slice()
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setStages(next)

    startTransition(async () => {
      const r = await reorderTemplateStages(template.id, next.map(s => s.id))
      if (!r.ok) {
        setError(r.error ?? 'Не удалось')
        refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
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
          <span className="text-sm flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs">×</button>
        </div>
      )}

      {/* Список этапов */}
      <div className="space-y-3">
        {stages.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 py-12 rounded-2xl"
            style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border-2)' }}
          >
            <p className="text-sm text-text-muted">Этапов пока нет</p>
            <p className="text-xs text-text-dim">Добавьте первый этап ниже</p>
          </div>
        ) : (
          stages.map((stage, idx) => (
            <StageEditor
              key={stage.id}
              stage={stage}
              index={idx}
              total={stages.length}
              templateId={template.id}
              onMove={moveStage}
              onDelete={() => deleteStage(stage.id)}
              onError={setError}
            />
          ))
        )}
      </div>

      {/* Добавить новый этап */}
      <div
        className="flex gap-2 p-3 rounded-2xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <input
          value={newStageName}
          onChange={e => setNewStageName(e.target.value)}
          placeholder="Название нового этапа"
          className="input flex-1"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addStage()
            }
          }}
        />
        <button
          type="button"
          onClick={addStage}
          disabled={!newStageName.trim()}
          className="btn-green text-sm disabled:opacity-40 flex items-center gap-2"
          style={{ padding: '8px 16px' }}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Добавить этап</span>
        </button>
      </div>
    </div>
  )
}

// ─── StageEditor ──────────────────────────────────────────────────────────

function StageEditor({
  stage,
  index,
  total,
  templateId,
  onMove,
  onDelete,
  onError,
}: {
  stage: Stage
  index: number
  total: number
  templateId: string
  onMove: (stageId: string, direction: -1 | 1) => void
  onDelete: () => void
  onError: (msg: string) => void
}) {
  const [editName, setEditName] = useState<string | null>(null)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [items, setItems] = useState(stage.checklist)
  const router = useRouter()

  function refresh() { router.refresh() }

  async function saveName() {
    if (editName === null) return
    const name = editName.trim()
    setEditName(null)
    if (!name || name === stage.name) return
    const r = await updateTemplateStage(stage.id, templateId, { name })
    if (!r.ok) onError(r.error ?? 'Не удалось')
    else refresh()
  }

  async function addItem() {
    if (!newItemLabel.trim()) return
    const label = newItemLabel.trim()
    setNewItemLabel('')
    const r = await addTemplateChecklistItem(stage.id, templateId, label)
    if (!r.ok) {
      onError(r.error ?? 'Не удалось')
      setNewItemLabel(label)
    } else {
      refresh()
    }
  }

  async function removeItem(itemId: string) {
    setItems(prev => prev.filter(i => i.id !== itemId))
    const r = await deleteTemplateChecklistItem(itemId, templateId)
    if (!r.ok) {
      onError(r.error ?? 'Не удалось')
      refresh()
    }
  }

  async function renameItem(itemId: string, newLabel: string) {
    const trimmed = newLabel.trim()
    if (!trimmed) return
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, label: trimmed } : i))
    const r = await updateTemplateChecklistItem(itemId, templateId, { label: trimmed })
    if (!r.ok) {
      onError(r.error ?? 'Не удалось')
      refresh()
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Шапка этапа */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {/* Reorder */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onMove(stage.id, -1)}
            disabled={index === 0}
            aria-label="Выше"
            className="p-0.5 rounded text-text-dim hover-text disabled:opacity-30"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => onMove(stage.id, 1)}
            disabled={index === total - 1}
            aria-label="Ниже"
            className="p-0.5 rounded text-text-dim hover-text disabled:opacity-30"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Drag handle (визуальный — DnD добавим позже) */}
        <GripVertical size={16} className="text-text-dim shrink-0 hidden md:block" />

        <span
          className="text-xs font-mono font-bold w-6 text-center shrink-0"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Название (inline edit) */}
        {editName !== null ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="input flex-1"
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); saveName() }
                if (e.key === 'Escape') setEditName(null)
              }}
            />
            <button type="button" onClick={saveName} className="p-1.5 rounded-lg text-green-500 hover-surface" aria-label="Сохранить">
              <Check size={14} />
            </button>
            <button type="button" onClick={() => setEditName(null)} className="p-1.5 rounded-lg text-text-muted hover-surface" aria-label="Отмена">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditName(stage.name)}
            className="flex-1 text-left text-base font-semibold text-text hover-text truncate"
          >
            {stage.name}
          </button>
        )}

        {editName === null && (
          <>
            <button
              type="button"
              onClick={() => setEditName(stage.name)}
              aria-label="Переименовать"
              className="p-1.5 rounded-lg text-text-dim hover-text hover-surface"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Удалить этап"
              className="p-1.5 rounded-lg text-text-dim hover-surface"
              style={{ color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* Чек-лист */}
      <div className="px-4 py-3 space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-text-dim italic">Пунктов чек-листа нет</p>
        )}
        {items.map(item => (
          <ChecklistItemEditor
            key={item.id}
            label={item.label}
            onSave={(newLabel) => renameItem(item.id, newLabel)}
            onDelete={() => removeItem(item.id)}
          />
        ))}

        {/* Добавление пункта */}
        <div className="flex gap-2 pt-1">
          <input
            value={newItemLabel}
            onChange={e => setNewItemLabel(e.target.value)}
            placeholder="Добавить пункт чек-листа"
            className="input flex-1 text-sm"
            style={{ minHeight: 38 }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); addItem() }
            }}
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!newItemLabel.trim()}
            className="text-sm px-3 rounded-xl flex items-center gap-1.5 disabled:opacity-40 hover-surface"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Добавить</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ChecklistItemEditor ──────────────────────────────────────────────────

function ChecklistItemEditor({
  label,
  onSave,
  onDelete,
}: {
  label: string
  onSave: (newLabel: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)

  function commit() {
    setEditing(false)
    if (value.trim() && value.trim() !== label) onSave(value.trim())
  }

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-text-dim)' }} />
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setEditing(false); setValue(label) }
          }}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text)' }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 text-left text-sm truncate text-text hover-text"
        >
          {label}
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Удалить пункт"
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover-surface"
        style={{ color: 'var(--color-danger)' }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
