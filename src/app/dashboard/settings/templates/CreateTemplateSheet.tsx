'use client'

import { useEffect, useState } from 'react'
import {
  X, Plus, Compass, Hammer, Briefcase, Layers, FolderOpen, Settings2, Check as CheckIcon,
} from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { createTemplate } from '@/lib/actions/templates'

const ICON_CHOICES: { name: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { name: 'compass',     Icon: Compass },
  { name: 'hammer',      Icon: Hammer },
  { name: 'briefcase',   Icon: Briefcase },
  { name: 'layers',      Icon: Layers },
  { name: 'folder-open', Icon: FolderOpen },
  { name: 'settings',    Icon: Settings2 },
]

const COLOR_CHOICES = [
  '#22c55e', // зелёный (бренд)
  '#3b82f6', // синий
  '#a855f7', // фиолетовый
  '#f59e0b', // оранжевый
  '#06b6d4', // циан
  '#f43f5e', // розовый
  '#10b981', // изумруд
  '#818cf8', // индиго
]

interface Props {
  onClose: () => void
  onCreated: (id: string) => void
}

export default function CreateTemplateSheet({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<string>('compass')
  const [color, setColor] = useState<string>('#22c55e')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit() {
    if (!name.trim() || creating) return
    setCreating(true)
    setError(null)
    const result = await createTemplate({
      name:        name.trim(),
      description: description.trim() || null,
      icon,
      color,
    })
    setCreating(false)
    if (!result.ok || !result.id) {
      setError(result.error ?? 'Не удалось создать шаблон')
      return
    }
    onCreated(result.id)
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100]"
        style={{ background: 'color-mix(in oklab, black 60%, transparent)' }}
        onClick={onClose}
        aria-hidden
      />

      <div
        className="fixed z-[101] flex flex-col
                   left-0 right-0 bottom-0 max-h-[88vh] rounded-t-2xl
                   sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                   sm:w-[480px] sm:max-h-[82vh] sm:rounded-2xl
                   animate-fade-up"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: `color-mix(in oklab, ${color} 18%, transparent)`,
              color,
            }}
          >
            <Layers size={20} strokeWidth={1.8} />
          </div>
          <h3 className="text-base font-semibold flex-1 text-text">Новый шаблон проекта</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-2 -m-2 rounded-lg hover-surface text-text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Название */}
          <div>
            <label className="text-xs font-medium block mb-1.5 text-text-dim">Название</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Строительство, Ремонт, Консалтинг"
              className="input w-full"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
          </div>

          {/* Описание */}
          <div>
            <label className="text-xs font-medium block mb-1.5 text-text-dim">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Когда использовать этот шаблон"
              rows={2}
              className="input w-full resize-none"
            />
          </div>

          {/* Иконка */}
          <div>
            <label className="text-xs font-medium block mb-2 text-text-dim">Иконка</label>
            <div className="grid grid-cols-6 gap-2">
              {ICON_CHOICES.map(({ name: iconName, Icon }) => {
                const selected = icon === iconName
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    className="aspect-square rounded-xl flex items-center justify-center transition-all"
                    style={{
                      background: selected
                        ? `color-mix(in oklab, ${color} 18%, transparent)`
                        : 'var(--color-surface-2)',
                      color: selected ? color : 'var(--color-text-muted)',
                      border: `1px solid ${selected ? color : 'var(--color-border)'}`,
                    }}
                    aria-label={`Иконка ${iconName}`}
                  >
                    <Icon size={18} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Цвет */}
          <div>
            <label className="text-xs font-medium block mb-2 text-text-dim">Цвет</label>
            <div className="grid grid-cols-8 gap-2">
              {COLOR_CHOICES.map(c => {
                const selected = color === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="aspect-square rounded-xl flex items-center justify-center transition-all"
                    style={{
                      background: `color-mix(in oklab, ${c} 22%, transparent)`,
                      border: `2px solid ${selected ? c : 'transparent'}`,
                      color: c,
                    }}
                    aria-label={`Цвет ${c}`}
                  >
                    {selected && <CheckIcon size={14} />}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <p
              className="text-sm px-3 py-2 rounded-xl"
              style={{ color: 'var(--color-danger)', background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)' }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex gap-2 px-5 py-3 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2.5 rounded-xl text-text-muted hover-text hover-surface transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={creating || !name.trim()}
            className="flex-1 btn-green text-sm disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ padding: '10px 16px' }}
          >
            <Plus size={16} />
            {creating ? 'Создание…' : 'Создать и перейти к этапам'}
          </button>
        </div>
      </div>
    </Portal>
  )
}
