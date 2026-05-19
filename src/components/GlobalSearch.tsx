'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, FolderOpen, CheckSquare, Send, Users, Calendar, CornerDownLeft } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { globalSearch, type SearchResult, type SearchResponse } from '@/lib/actions/search'

const EMPTY: SearchResponse = {
  projects: [], project_tasks: [], direct_tasks: [], profiles: [], events: [], total: 0,
}

const KIND_META: Record<SearchResult['kind'], { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  project:      { label: 'Проекты',    icon: FolderOpen,  color: '#22c55e' },
  project_task: { label: 'Задачи',     icon: CheckSquare, color: '#60a5fa' },
  direct_task:  { label: 'Поручения',  icon: Send,        color: '#a78bfa' },
  profile:      { label: 'Сотрудники', icon: Users,       color: '#fb923c' },
  event:        { label: 'События',    icon: Calendar,    color: '#06b6d4' },
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse>(EMPTY)
  const [highlight, setHighlight] = useState(0)
  const [, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cmd/Ctrl+K — открыть поиск из любого места
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // На мобиле точка входа в поиск — кнопка по центру bottom-nav (в Sidebar).
  // Она шлёт это событие, ловим тут и открываем модалку.
  useEffect(() => {
    function onOpen() { setOpen(true) }
    window.addEventListener('wag:search:open', onOpen)
    return () => window.removeEventListener('wag:search:open', onOpen)
  }, [])

  // Сброс при закрытии
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults(EMPTY)
      setHighlight(0)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults(EMPTY)
      return
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const data = await globalSearch(query)
        setResults(data)
        setHighlight(0)
      })
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Плоский список для навигации стрелками
  const flat: SearchResult[] = useMemo(() => [
    ...results.projects,
    ...results.project_tasks,
    ...results.direct_tasks,
    ...results.profiles,
    ...results.events,
  ], [results])

  function go(r: SearchResult) {
    setOpen(false)
    router.push(r.url)
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (flat.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[highlight]
      if (item) go(item)
    }
  }

  let cursor = 0
  return (
    <>
      {open && (
    <Portal>
      <div
        className="fixed inset-0 z-[100]"
        style={{ background: 'color-mix(in oklab, black 60%, transparent)' }}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        className="fixed z-[101] flex flex-col
                   left-2 right-2 top-2 max-h-[92vh] rounded-2xl
                   sm:left-1/2 sm:right-auto sm:top-[12vh] sm:-translate-x-1/2 sm:w-[640px] sm:max-h-[76vh]
                   animate-fade-up"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Search size={18} className="shrink-0 text-text-muted" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Найти проект, задачу, сотрудника, событие…"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-text-dim"
            style={{ color: 'var(--text)' }}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Закрыть"
            className="p-1.5 rounded-lg text-text-dim hover-surface"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto py-2">
          {query.trim().length < 2 ? (
            <Hint />
          ) : results.total === 0 ? (
            <p className="text-center text-sm text-text-muted py-12">Ничего не найдено</p>
          ) : (
            <>
              <ResultGroup kind="project"      items={results.projects}      cursorStart={(() => { const c = cursor; cursor += results.projects.length; return c })()} highlight={highlight} onPick={go} />
              <ResultGroup kind="project_task" items={results.project_tasks} cursorStart={(() => { const c = cursor; cursor += results.project_tasks.length; return c })()} highlight={highlight} onPick={go} />
              <ResultGroup kind="direct_task"  items={results.direct_tasks}  cursorStart={(() => { const c = cursor; cursor += results.direct_tasks.length; return c })()} highlight={highlight} onPick={go} />
              <ResultGroup kind="profile"      items={results.profiles}      cursorStart={(() => { const c = cursor; cursor += results.profiles.length; return c })()} highlight={highlight} onPick={go} />
              <ResultGroup kind="event"        items={results.events}        cursorStart={(() => { const c = cursor; cursor += results.events.length; return c })()} highlight={highlight} onPick={go} />
            </>
          )}
        </div>

        {/* Footer hints */}
        <div
          className="px-4 py-2 border-t shrink-0 flex items-center gap-3 text-xs"
          style={{ borderColor: 'var(--color-border)', color: 'var(--text-dim)' }}
        >
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--color-border)' }}>↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--color-border)' }}>↓</kbd>
            навигация
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border inline-flex items-center" style={{ borderColor: 'var(--color-border)' }}>
              <CornerDownLeft size={11} />
            </kbd>
            открыть
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--color-border)' }}>Esc</kbd>
            закрыть
          </span>
          <span className="ml-auto hidden sm:inline">
            <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--color-border)' }}>Ctrl+K</kbd>
          </span>
        </div>
      </div>
    </Portal>
      )}
    </>
  )
}

function Hint() {
  return (
    <div className="p-6 space-y-3 text-sm text-text-muted">
      <p className="font-medium text-text">Найдите что угодно в системе</p>
      <ul className="space-y-1.5 text-xs">
        <li>• Проекты — по названию, заказчику или номеру договора</li>
        <li>• Задачи проекта — по названию</li>
        <li>• Поручения — по названию</li>
        <li>• Сотрудники — по имени или должности</li>
        <li>• События</li>
      </ul>
    </div>
  )
}

function ResultGroup({
  kind, items, cursorStart, highlight, onPick,
}: {
  kind: SearchResult['kind']
  items: SearchResult[]
  cursorStart: number
  highlight: number
  onPick: (r: SearchResult) => void
}) {
  if (items.length === 0) return null
  const meta = KIND_META[kind]
  const Icon = meta.icon
  return (
    <div className="mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider px-4 mb-1 text-text-dim">
        {meta.label}
      </p>
      {items.map((item, idx) => {
        const globalIdx = cursorStart + idx
        const isHighlighted = globalIdx === highlight
        return (
          <button
            key={`${kind}-${item.id}`}
            type="button"
            onClick={() => onPick(item)}
            onMouseEnter={() => { /* hover не двигает highlight — пользователь может стрелкой выбирать */ }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
            style={{
              background: isHighlighted ? 'var(--color-surface-2)' : 'transparent',
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: `color-mix(in oklab, ${meta.color} 18%, transparent)`,
                color: meta.color,
              }}
            >
              <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{item.title}</p>
              {item.subtitle && (
                <p className="text-xs truncate text-text-muted">{item.subtitle}</p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
