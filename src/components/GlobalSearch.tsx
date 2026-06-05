'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, X, FolderOpen, FolderPlus, CheckSquare, Send, Users, Calendar,
  Clock, Gauge, MessageCircleQuestion, History, CornerDownLeft,
} from 'lucide-react'
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

// ─── Команды-действия в палитре ────────────────────────────────────────────
type Role = 'admin' | 'director' | 'manager' | 'employee'

type Command = {
  id: string
  title: string
  url: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
  keywords: string
  roles: Role[]
}

const ALL_ROLES: Role[] = ['admin', 'director', 'manager', 'employee']

// roles здесь зеркалят гварды страниц (assign/new — hasManagerAccess,
// deadlines/workload — hasDirectorAccess, projects/new — не employee),
// чтобы команда не вела пользователя в редирект на /dashboard.
const COMMANDS: Command[] = [
  { id: 'new-direct',   title: 'Новое поручение',  url: '/dashboard/assign/new',   icon: Send,                  color: '#a78bfa', keywords: 'новое поручение создать выдать assign', roles: ['admin', 'director', 'manager'] },
  { id: 'new-project',  title: 'Новый проект',     url: '/dashboard/projects/new', icon: FolderPlus,            color: '#22c55e', keywords: 'новый проект создать',                  roles: ['admin', 'director', 'manager'] },
  { id: 'go-projects',  title: 'Все проекты',      url: '/dashboard/projects',     icon: FolderOpen,            color: '#22c55e', keywords: 'проекты список',                       roles: ALL_ROLES },
  { id: 'go-daily',     title: 'Дейли-отчёт',      url: '/dashboard/daily',        icon: Calendar,              color: '#06b6d4', keywords: 'дейли отчёт ежедневный план',          roles: ALL_ROLES },
  { id: 'go-deadlines', title: 'Дедлайны',         url: '/dashboard/deadlines',    icon: Clock,                 color: '#fb923c', keywords: 'дедлайны сроки светофор',               roles: ['admin', 'director'] },
  { id: 'go-workload',  title: 'Загрузка команды', url: '/dashboard/workload',     icon: Gauge,                 color: '#60a5fa', keywords: 'загрузка команды wip нагрузка',        roles: ['admin', 'director'] },
  { id: 'go-polls',     title: 'Опросы',           url: '/dashboard/polls',        icon: MessageCircleQuestion, color: '#22d3ee', keywords: 'опросы голосование',                   roles: ALL_ROLES },
  { id: 'go-events',    title: 'События',          url: '/dashboard/events',       icon: Calendar,              color: '#a78bfa', keywords: 'события календарь мероприятия',         roles: ALL_ROLES },
]

// ─── Недавно открытое (localStorage) ───────────────────────────────────────
const RECENT_KEY = 'wag:search:recent'
const RECENT_MAX = 5

type RecentItem = { kind: SearchResult['kind']; id: string; title: string; subtitle: string | null; url: string }

function loadRecent(): RecentItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

function pushRecent(item: RecentItem) {
  if (typeof window === 'undefined') return
  try {
    const prev = loadRecent().filter(r => !(r.kind === item.kind && r.id === item.id))
    window.localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...prev].slice(0, RECENT_MAX)))
  } catch {
    /* private mode — localStorage недоступен, тихо пропускаем */
  }
}

// Унифицированная навигационная запись для клавиатуры/мыши
type Entry =
  | { kind: 'command'; item: Command }
  | { kind: 'result';  item: SearchResult | RecentItem }

export default function GlobalSearch({ role }: { role: Role }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse>(EMPTY)
  const [recent, setRecent] = useState<RecentItem[]>([])
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

  // Уведомляем Sidebar о реальном состоянии модалки, чтобы кнопка поиска
  // в мобильном bottom-nav подсвечивалась только когда поиск открыт.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('wag:search:state', { detail: { open } }))
  }, [open])

  // Сброс при закрытии / подгрузка недавнего при открытии — set-in-render
  // с парным state, см.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [lastOpen, setLastOpen] = useState(open)
  if (lastOpen !== open) {
    setLastOpen(open)
    if (open) {
      setRecent(loadRecent())
    } else {
      setQuery('')
      setResults(EMPTY)
      setHighlight(0)
    }
  }

  // Debounced search. При короткой строке результаты не очищаем — render и так
  // показывает команды/подсказку по тому же условию, старые результаты не видны.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) return
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

  const availableCommands = useMemo(() => COMMANDS.filter(c => c.roles.includes(role)), [role])

  const matchedCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []
    return availableCommands.filter(c => c.title.toLowerCase().includes(q) || c.keywords.includes(q))
  }, [query, availableCommands])

  const isEmpty = query.trim().length === 0

  // Плоский список для навигации стрелками: пусто → недавнее; иначе команды + результаты
  const flat: Entry[] = useMemo(() => {
    if (isEmpty) return recent.map(r => ({ kind: 'result' as const, item: r }))
    return [
      ...matchedCommands.map(c => ({ kind: 'command' as const, item: c })),
      ...results.projects.map(r => ({ kind: 'result' as const, item: r })),
      ...results.project_tasks.map(r => ({ kind: 'result' as const, item: r })),
      ...results.direct_tasks.map(r => ({ kind: 'result' as const, item: r })),
      ...results.profiles.map(r => ({ kind: 'result' as const, item: r })),
      ...results.events.map(r => ({ kind: 'result' as const, item: r })),
    ]
  }, [isEmpty, recent, matchedCommands, results])

  function activate(entry: Entry) {
    setOpen(false)
    if (entry.kind === 'command') {
      router.push(entry.item.url)
    } else {
      const r = entry.item
      pushRecent({ kind: r.kind, id: r.id, title: r.title, subtitle: r.subtitle, url: r.url })
      router.push(r.url)
    }
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
      if (item) activate(item)
    }
  }

  // Стартовые позиции курсора для секций результатов — нельзя мутировать
  // переменную в JSX (React 19: react-hooks/immutability). Команды идут первыми.
  const cursorStarts = (() => {
    const command      = 0
    const project      = command       + matchedCommands.length
    const project_task = project       + results.projects.length
    const direct_task  = project_task  + results.project_tasks.length
    const profile      = direct_task   + results.direct_tasks.length
    const event        = profile       + results.profiles.length
    return { command, project, project_task, direct_task, profile, event }
  })()

  const searching = query.trim().length >= 2
  const nothingFound = searching && results.total === 0 && matchedCommands.length === 0

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
            placeholder="Найти или перейти: проект, задача, сотрудник, команда…"
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
          {isEmpty ? (
            <>
              {recent.length > 0 && (
                <RecentGroup items={recent} cursorStart={0} highlight={highlight} onPick={activate} />
              )}
              <Hint />
            </>
          ) : nothingFound ? (
            <p className="text-center text-sm text-text-muted py-12">Ничего не найдено</p>
          ) : (
            <>
              <CommandGroup items={matchedCommands} cursorStart={cursorStarts.command} highlight={highlight} onPick={activate} />
              {searching && (
                <>
                  <ResultGroup kind="project"      items={results.projects}      cursorStart={cursorStarts.project}      highlight={highlight} onPick={activate} />
                  <ResultGroup kind="project_task" items={results.project_tasks} cursorStart={cursorStarts.project_task} highlight={highlight} onPick={activate} />
                  <ResultGroup kind="direct_task"  items={results.direct_tasks}  cursorStart={cursorStarts.direct_task}  highlight={highlight} onPick={activate} />
                  <ResultGroup kind="profile"      items={results.profiles}      cursorStart={cursorStarts.profile}      highlight={highlight} onPick={activate} />
                  <ResultGroup kind="event"        items={results.events}        cursorStart={cursorStarts.event}        highlight={highlight} onPick={activate} />
                </>
              )}
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
      <p className="font-medium text-text">Найдите что угодно или перейдите командой</p>
      <ul className="space-y-1.5 text-xs">
        <li>• Проекты — по названию, заказчику или номеру договора</li>
        <li>• Задачи и поручения — по названию</li>
        <li>• Сотрудники — по имени или должности</li>
        <li>• Команды — «новое поручение», «дедлайны», «загрузка»…</li>
      </ul>
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider px-4 mb-1 text-text-dim">
      {children}
    </p>
  )
}

function Row({
  icon: Icon, color, title, subtitle, isHighlighted, onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
  title: string
  subtitle?: string | null
  isHighlighted: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
      style={{ background: isHighlighted ? 'var(--color-surface-2)' : 'transparent' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      >
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{title}</p>
        {subtitle && <p className="text-xs truncate text-text-muted">{subtitle}</p>}
      </div>
    </button>
  )
}

function CommandGroup({
  items, cursorStart, highlight, onPick,
}: {
  items: Command[]
  cursorStart: number
  highlight: number
  onPick: (e: Entry) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-2">
      <GroupLabel>Команды</GroupLabel>
      {items.map((cmd, idx) => (
        <Row
          key={`cmd-${cmd.id}`}
          icon={cmd.icon}
          color={cmd.color}
          title={cmd.title}
          isHighlighted={cursorStart + idx === highlight}
          onClick={() => onPick({ kind: 'command', item: cmd })}
        />
      ))}
    </div>
  )
}

function RecentGroup({
  items, cursorStart, highlight, onPick,
}: {
  items: RecentItem[]
  cursorStart: number
  highlight: number
  onPick: (e: Entry) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-2">
      <GroupLabel>
        <span className="inline-flex items-center gap-1.5"><History size={11} /> Недавнее</span>
      </GroupLabel>
      {items.map((item, idx) => {
        const meta = KIND_META[item.kind] ?? KIND_META.project
        return (
          <Row
            key={`recent-${item.kind}-${item.id}`}
            icon={meta.icon}
            color={meta.color}
            title={item.title}
            subtitle={item.subtitle}
            isHighlighted={cursorStart + idx === highlight}
            onClick={() => onPick({ kind: 'result', item })}
          />
        )
      })}
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
  onPick: (e: Entry) => void
}) {
  if (items.length === 0) return null
  const meta = KIND_META[kind]
  return (
    <div className="mb-2">
      <GroupLabel>{meta.label}</GroupLabel>
      {items.map((item, idx) => (
        <Row
          key={`${kind}-${item.id}`}
          icon={meta.icon}
          color={meta.color}
          title={item.title}
          subtitle={item.subtitle}
          isHighlighted={cursorStart + idx === highlight}
          onClick={() => onPick({ kind: 'result', item })}
        />
      ))}
    </div>
  )
}
