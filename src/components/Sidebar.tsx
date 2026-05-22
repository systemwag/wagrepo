'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LogOut, ChevronDown, ChevronUp, Home, FolderOpen, Users, ClipboardList, Bell, Search,
  Clock, GanttChart, Send, Calendar, CheckSquare, FileText, Activity, FlaskConical, Wrench, Layers, ArrowRightLeft, Gauge, User, MessageCircleQuestion,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import NotificationDot from './NotificationDot'
import { useHaptic } from '@/lib/hooks/useHaptic'
import { useMobileNavSignals } from '@/lib/hooks/useMobileNavSignals'

type Profile = {
  id: string
  full_name: string
  role: 'admin' | 'director' | 'manager' | 'employee'
  position: string | null
  department: string | null
}

type ChildItem = { label: string; href: string }
type NavItem = {
  type?: 'item'
  label: string
  href: string
  icon: React.ReactNode
  roles: Profile['role'][]
  children?: ChildItem[]
  comingSoon?: boolean
}
type NavDivider = {
  type: 'divider'
  label: string
  roles: Profile['role'][]
}
type NavEntry = NavItem | NavDivider

const ICON_PROPS = { size: 20, strokeWidth: 1.6 } as const

const nav: NavEntry[] = [
  // ── Обзор ────────────────────────────────────────────────────────────────
  { label: 'Главная',    href: '/dashboard',           roles: ['director', 'manager', 'employee'], icon: <Home {...ICON_PROPS} /> },
  { label: 'Дедлайны',   href: '/dashboard/deadlines', roles: ['director'],                        icon: <Clock {...ICON_PROPS} /> },

  // ── Проекты ───────────────────────────────────────────────────────────────
  { type: 'divider', label: 'Проекты', roles: ['director', 'manager', 'employee'] },
  { label: 'Проекты',          href: '/dashboard/projects',           roles: ['director', 'manager', 'employee'], icon: <FolderOpen {...ICON_PROPS} /> },
  { label: 'График Ганта',     href: '/dashboard/gantt',              roles: ['director'],                        icon: <GanttChart {...ICON_PROPS} /> },
  { label: 'Шаблоны проектов', href: '/dashboard/settings/templates', roles: ['director'],                        icon: <Layers {...ICON_PROPS} /> },

  // ── Поручения ─────────────────────────────────────────────────────────────
  // Прямые задания «купи кофе, принеси договор». Не связаны с проектами.
  { type: 'divider', label: 'Поручения', roles: ['director', 'manager', 'employee'] },
  { label: 'Новое поручение',  href: '/dashboard/assign/new', roles: ['director', 'manager'], icon: <Send {...ICON_PROPS} /> },
  { label: 'Журнал поручений', href: '/dashboard/assign',     roles: ['director', 'manager'], icon: <ClipboardList {...ICON_PROPS} /> },
  { label: 'Мои поручения',    href: '/dashboard/assignments', roles: ['director', 'manager', 'employee'], icon: <Send {...ICON_PROPS} /> },

  // ── Задачи ────────────────────────────────────────────────────────────────
  // Задачи в рамках проектов (привязаны к этапу, часть рабочего процесса).
  { type: 'divider', label: 'Задачи', roles: ['director', 'manager', 'employee'] },
  { label: 'Мои задачи в проектах', href: '/dashboard/tasks', roles: ['director', 'manager', 'employee'], icon: <CheckSquare {...ICON_PROPS} /> },

  // ── Люди ──────────────────────────────────────────────────────────────────
  { type: 'divider', label: 'Люди', roles: ['director', 'manager', 'employee'] },
  { label: 'Сотрудники',       href: '/dashboard/employees',     roles: ['director'],                        icon: <Users {...ICON_PROPS} /> },
  { label: 'Загрузка команды', href: '/dashboard/workload',      roles: ['director'],                        icon: <Gauge {...ICON_PROPS} /> },
  { label: 'Моя загрузка',     href: '/dashboard/me',            roles: ['manager', 'employee'],             icon: <Gauge {...ICON_PROPS} /> },
  { label: 'Перекличка',       href: '/dashboard/handover',      roles: ['director', 'manager', 'employee'], icon: <ArrowRightLeft {...ICON_PROPS} /> },
  { label: 'Мой профиль',      href: '/dashboard/profile',       roles: ['director', 'manager', 'employee'], icon: <User {...ICON_PROPS} /> },

  // ── Активность ────────────────────────────────────────────────────────────
  { type: 'divider', label: 'Активность', roles: ['director', 'manager', 'employee'] },
  { label: 'Мероприятия',    href: '/dashboard/events',        roles: ['director', 'manager', 'employee'], icon: <Calendar {...ICON_PROPS} /> },
  { label: 'Дейли-отчёт',    href: '/dashboard/daily',         roles: ['director', 'manager', 'employee'], icon: <FileText {...ICON_PROPS} /> },
  { label: 'Отчёты команды', href: '/dashboard/daily/team',    roles: ['director'],                        icon: <Users {...ICON_PROPS} /> },
  { label: 'Пульс компании', href: '/dashboard/activity',      roles: ['director'],                        icon: <Activity {...ICON_PROPS} /> },
  { label: 'Опросы',         href: '/dashboard/polls',         roles: ['director', 'manager', 'employee'], icon: <MessageCircleQuestion {...ICON_PROPS} /> },
  { label: 'Уведомления',    href: '/dashboard/notifications', roles: ['director', 'manager', 'employee'], icon: <Bell {...ICON_PROPS} /> },

  // ── Разработка (только admin) ─────────────────────────────────────────────
  { type: 'divider', label: 'Разработка', roles: ['admin'] },
  { label: 'Админ-инструменты', href: '/dashboard/admin',          roles: ['admin'], icon: <Wrench {...ICON_PROPS} /> },
  {
    label: '[ТЕСТ] Модули',
    href: '/dashboard/test/quick-tasks',
    roles: ['admin'],
    icon: <FlaskConical {...ICON_PROPS} />,
    children: [
      { label: 'Быстрые поручения', href: '/dashboard/test/quick-tasks' },
      { label: 'Согласования',      href: '/dashboard/test/document-approvals' },
      { label: 'Аналитика узких',   href: '/dashboard/test/bottlenecks' },
      { label: 'Фокус / WIP',       href: '/dashboard/test/focus-mode' },
      { label: 'Канбан проектов',   href: '/dashboard/test/projects-board' },
    ],
  },
]

const roleLabel: Record<Profile['role'], string> = {
  admin:    'Admin',
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}

export default function Sidebar({ profile }: { profile: Profile }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [expanded, setExpanded] = useState(false)
  // Admin видит всё — игнорируем roles. Остальные роли фильтруются как обычно.
  const visibleNav = profile.role === 'admin'
    ? nav
    : nav.filter(item => item.roles.includes(profile.role))

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <aside
        data-expanded={expanded}
        className="fixed left-0 top-0 h-full z-40 flex-col py-3 hidden md:flex bg-surface border-r border-border overflow-hidden
                   transition-[width] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]
                   w-14 data-[expanded=true]:w-[220px]"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Лого */}
        <div className="shrink-0 relative px-3 mb-3 overflow-hidden h-20">
          {/* Треугольник-марка — виден только в свёрнутом сайдбаре */}
          <div className={`absolute inset-y-0 left-3 flex items-center transition-opacity duration-200 ${expanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark-gold.svg" alt="WAG" className="w-7 h-7" />
            </div>
          </div>
          {/* Полный логотип — виден при раскрытии */}
          <div className={`absolute inset-x-5 top-3 bottom-3 flex items-center justify-center transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gold.svg" alt="WAG" style={{ width: '140px', height: 'auto' }} />
          </div>
        </div>

        {/* Разделитель */}
        <div className="mx-3 mb-2 shrink-0 h-px bg-border" />

        {/* Навигация */}
        <nav className="flex flex-col gap-0.5 flex-1 px-1.5 overflow-y-auto overflow-x-hidden">
          {visibleNav.map((entry, idx) => {
            if (entry.type === 'divider') {
              return (
                <div key={`div-${idx}`} className="flex items-center gap-2 px-2 mt-2 mb-0.5 min-h-6">
                  <div className={`h-px bg-border ${expanded ? 'basis-2 grow-0' : 'flex-1'}`} />
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap overflow-hidden text-text-dim transition-[max-width,opacity] duration-200
                                ${expanded ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0'}`}
                  >
                    {entry.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )
            }

            const item = entry as NavItem
            const isExact = pathname === item.href
            const isGroupActive = item.href !== '/dashboard' && pathname.startsWith(item.href + '/')
            const hasMoreSpecificMatch = !item.children && visibleNav.some(other =>
              other.type !== 'divider' &&
              (other as NavItem).href !== item.href &&
              (other as NavItem).href.startsWith(item.href + '/') &&
              (pathname === (other as NavItem).href || pathname.startsWith((other as NavItem).href + '/'))
            )
            const isActive = item.children
              ? (isExact || isGroupActive)
              : isExact || (item.href !== '/dashboard' && isGroupActive && !hasMoreSpecificMatch)

            return (
              <NavRow
                key={item.href}
                item={item}
                isActive={isActive}
                pathname={pathname}
                sidebarExpanded={expanded}
                userId={profile.id}
              />
            )
          })}
        </nav>

        {/* Низ: профиль + выход */}
        <div className="px-1.5 shrink-0">
          <div className="mx-2 mb-2 h-px bg-border" />

          {/* Профиль — кликабельный, ведёт на /dashboard/profile */}
          <Link
            href="/dashboard/profile"
            data-active={pathname === '/dashboard/profile'}
            data-expanded={expanded}
            className="flex items-center h-[52px] rounded-xl transition-colors hover:bg-surface-2/50
                       gap-0 justify-center px-0
                       data-[expanded=true]:gap-3 data-[expanded=true]:justify-start data-[expanded=true]:px-2
                       data-[active=true]:bg-[color:color-mix(in_oklab,var(--color-green)_10%,transparent)]"
            title="Мой профиль"
          >
            <div
              className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold"
              style={{
                background: 'color-mix(in oklab, var(--color-green) 15%, transparent)',
                color: 'var(--color-green)',
                border: '1px solid color-mix(in oklab, var(--color-green) 25%, transparent)',
              }}
            >
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div
              className={`min-w-0 overflow-hidden ${expanded ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0'}`}
            >
              <p className="text-xs font-semibold whitespace-nowrap truncate text-text">
                {profile.full_name}
              </p>
              <p className="text-xs whitespace-nowrap text-text-dim">
                {roleLabel[profile.role]}
              </p>
            </div>
          </Link>

          {/* Выход */}
          <button
            onClick={handleLogout}
            data-expanded={expanded}
            className="group w-full flex items-center h-[52px] rounded-xl transition-colors text-text-dim
                       gap-0 justify-center px-0
                       data-[expanded=true]:gap-3 data-[expanded=true]:justify-start data-[expanded=true]:px-2
                       hover:!text-[color:var(--color-danger)]
                       hover:bg-[color:color-mix(in_oklab,var(--color-danger)_8%,transparent)]"
          >
            <div className="w-10 h-10 shrink-0 flex items-center justify-center">
              <LogOut size={17} />
            </div>
            <span
              className={`text-sm whitespace-nowrap overflow-hidden ${expanded ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0'}`}
            >
              Выйти
            </span>
          </button>
        </div>
      </aside>
      <MobileBottomNav profile={profile} pathname={pathname} />
    </>
  )
}

// ─── Мобильная навигация: группы + всплывающие кружочки ─────────────────────

const GROUP_ICONS: Record<string, React.ReactNode> = {
  'Обзор':       <Home {...{ size: 20 }} />,
  'Проекты':     <FolderOpen size={20} />,
  'Поручения':   <Send size={20} />,
  'Задачи':      <CheckSquare size={20} />,
  'Люди':        <Users size={20} />,
  'Активность':  <Activity size={20} />,
  'Разработка':  <Wrench size={20} />,
}

const ITEM_LABELS: Record<string, string> = {
  '/dashboard':                          'Главная',
  '/dashboard/deadlines':                'Дедлайны',
  '/dashboard/projects':                 'Проекты',
  '/dashboard/test/projects-board':      'Канбан [тест]',
  '/dashboard/gantt':                    'Ганта',
  '/dashboard/assign':                   'Журнал',
  '/dashboard/assign/new':               'Поручить',
  '/dashboard/assignments':              'Поручения',
  '/dashboard/employees':                'Команда',
  '/dashboard/workload':                 'Загрузка',
  '/dashboard/me':                       'Моя загрузка',
  '/dashboard/handover':                 'Перекличка',
  '/dashboard/events':                   'События',
  '/dashboard/tasks':                    'Задачи',
  '/dashboard/daily':                    'Дейли',
  '/dashboard/daily/team':               'Отчёты',
  '/dashboard/polls':                    'Опросы',
  '/dashboard/notifications':            'Уведомления',
  '/dashboard/profile':                  'Профиль',
  '/dashboard/activity':                 'Пульс',
  '/dashboard/settings/templates':       'Шаблоны',
  '/dashboard/admin':                    'Админ',
  '/dashboard/test/quick-tasks':         'Быстрые',
  '/dashboard/test/document-approvals':  'Согласования',
  '/dashboard/test/bottlenecks':         'Узкие места',
  '/dashboard/test/focus-mode':          'Фокус/WIP',
}

type MobileGroup = { label: string; items: NavItem[] }

function buildMobileGroups(role: Profile['role']): MobileGroup[] {
  const result: MobileGroup[] = []
  let currentLabel = 'Обзор'
  let currentItems: NavItem[] = []
  const isAdmin = role === 'admin'
  const canSee = (roles: Profile['role'][]) => isAdmin || roles.includes(role)

  for (const entry of nav) {
    if (entry.type === 'divider') {
      // Раздел «Разработка» (тест-модули + админ-инструменты) показываем только admin.
      if (entry.label === 'Разработка' && !isAdmin) break
      if (currentItems.length > 0) result.push({ label: currentLabel, items: currentItems })
      currentLabel = canSee(entry.roles) ? entry.label : ''
      currentItems = []
    } else {
      if (!canSee(entry.roles)) continue
      // Тестовые модули — только для admin.
      if (entry.href.startsWith('/dashboard/test') && !isAdmin) continue
      if (!currentLabel) continue
      if (entry.children) {
        for (const child of entry.children) {
          currentItems.push({ ...entry, label: child.label, href: child.href, children: undefined })
        }
      } else {
        currentItems.push(entry)
      }
    }
  }
  if (currentLabel && currentItems.length > 0) result.push({ label: currentLabel, items: currentItems })
  return result
}

function MobileBottomNav({ profile, pathname }: { profile: Profile; pathname: string }) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const groups = buildMobileGroups(profile.role)
  const submenuItems = groups.find(g => g.label === openGroup)?.items ?? []
  const haptic = useHaptic()
  const signals = useMobileNavSignals(profile.id)

  // Swipe-down: тащим панель за палец, при пороге 50px — закрываем.
  // Прямые DOM-манипуляции через ref — без ререндеров на каждом move.
  const panelRef     = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<number | null>(null)
  const dragYRef     = useRef(0)

  // Любая смена маршрута закрывает submenu — даже если пользователь ушёл
  // не тапом по пункту меню (back, deep-link, push-уведомление).
  useEffect(() => {
    setOpenGroup(null)
  }, [pathname])

  // Слушаем реальное состояние модалки поиска, чтобы подсвечивать кнопку
  // только когда поиск открыт, а не на каждой странице.
  useEffect(() => {
    function onState(e: Event) {
      const detail = (e as CustomEvent<{ open: boolean }>).detail
      setSearchOpen(!!detail?.open)
    }
    window.addEventListener('wag:search:state', onState)
    return () => window.removeEventListener('wag:search:state', onState)
  }, [])

  // Escape закрывает submenu (полезно для планшетов с клавиатурой и для a11y).
  useEffect(() => {
    if (!openGroup) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenGroup(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openGroup])

  function handleGroupPress(group: MobileGroup) {
    if (group.items.length === 1) {
      setOpenGroup(null)
      return
    }
    setOpenGroup(prev => prev === group.label ? null : group.label)
  }

  function onPanelTouchStart(e: React.TouchEvent) {
    dragStartRef.current = e.touches[0].clientY
    dragYRef.current = 0
    if (panelRef.current) panelRef.current.style.transition = 'none'
  }
  function onPanelTouchMove(e: React.TouchEvent) {
    if (dragStartRef.current == null || !panelRef.current) return
    const delta = e.touches[0].clientY - dragStartRef.current
    if (delta > 0) {
      dragYRef.current = delta
      panelRef.current.style.transform = `translateY(${delta}px)`
    }
  }
  function onPanelTouchEnd() {
    if (panelRef.current) {
      panelRef.current.style.transition = ''
      panelRef.current.style.transform = ''
    }
    if (dragYRef.current > 50) setOpenGroup(null)
    dragStartRef.current = null
    dragYRef.current = 0
  }

  // Какой бейдж показать на иконке группы. Точка прячется на странице,
  // соответствующей сигналу, — она там уже не несёт информации.
  function getGroupBadgeColor(group: MobileGroup): string | null {
    const hrefs = group.items.map(i => i.href)
    if (hrefs.includes('/dashboard/notifications') && signals.unread > 0 && pathname !== '/dashboard/notifications') {
      return 'var(--color-green)'
    }
    if (hrefs.includes('/dashboard/assignments') && signals.overdueDirect > 0 && pathname !== '/dashboard/assignments') {
      return 'var(--color-warn)'
    }
    if (hrefs.includes('/dashboard/tasks') && signals.overdueProject > 0 && pathname !== '/dashboard/tasks') {
      return 'var(--color-warn)'
    }
    return null
  }

  return (
    <>
      {/* Затемняющий оверлей */}
      {openGroup && (
        <div
          className="fixed inset-0 z-40 md:hidden bg-black/45 backdrop-blur-[2px]"
          onClick={() => setOpenGroup(null)}
        />
      )}

      {/* Всплывающая панель — плоский список */}
      <div
        ref={panelRef}
        data-open={!!openGroup}
        onTouchStart={onPanelTouchStart}
        onTouchMove={onPanelTouchMove}
        onTouchEnd={onPanelTouchEnd}
        className="fixed left-0 right-0 z-[49] md:hidden px-3
                   transition-[transform,opacity]
                   duration-[260ms] ease-[cubic-bezier(0.34,1.3,0.64,1)]
                   translate-y-3 opacity-0 pointer-events-none
                   data-[open=true]:translate-y-0 data-[open=true]:opacity-100 data-[open=true]:pointer-events-auto"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          className="bg-surface border border-border-2 rounded-2xl p-2.5 grid gap-1.5"
          style={{
            boxShadow: '0 -8px 32px rgba(0,0,0,0.45)',
            gridTemplateColumns: submenuItems.length <= 2 ? '1fr' : 'repeat(2, 1fr)',
          }}
        >
          {/* Drag-handle — подсказка «панель смахивается вниз» */}
          <div
            className="h-1 w-9 rounded-full mx-auto opacity-50 -mt-1 mb-1"
            style={{
              background: 'var(--color-border-2)',
              gridColumn: submenuItems.length <= 2 ? '1' : '1 / -1',
            }}
            aria-hidden
          />
          {submenuItems.map((item, i) => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
            const label = ITEM_LABELS[item.href] ?? item.label

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { setOpenGroup(null); haptic.tap() }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border no-underline transition-transform active:scale-[0.97]"
                style={{
                  background: isActive
                    ? 'color-mix(in oklab, var(--color-green) 15%, transparent)'
                    : 'var(--color-surface-2)',
                  borderColor: isActive
                    ? 'color-mix(in oklab, var(--color-green) 25%, transparent)'
                    : 'var(--color-border)',
                  color: isActive ? 'var(--color-green)' : 'var(--color-text-muted)',
                  // Левая зелёная полоска у активного пункта — заметнее, чем точка справа,
                  // и не сдвигает контент благодаря inset box-shadow.
                  boxShadow: isActive ? 'inset 3px 0 0 var(--color-green)' : undefined,
                  animation: openGroup ? `pop-in 280ms cubic-bezier(0.34,1.4,0.64,1) ${i * 22}ms both` : 'none',
                }}
              >
                <span
                  className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 border"
                  style={{
                    background: isActive
                      ? 'color-mix(in oklab, var(--color-green) 30%, transparent)'
                      : 'var(--color-surface)',
                    borderColor: isActive
                      ? 'color-mix(in oklab, var(--color-green) 35%, transparent)'
                      : 'var(--color-border)',
                  }}
                >
                  {item.icon}
                </span>
                <span className={`text-[13px] flex-1 truncate ${isActive ? 'font-bold' : 'font-semibold'}`}>{label}</span>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Нижний бар с группами */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden mobile-nav-bar bg-surface border-t border-border">
        <div className="flex">
          {(() => {
            const renderGroup = (group: MobileGroup) => {
              const groupActive = group.items.some(item =>
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/')
              )
              const isOpen = openGroup === group.label
              // Когда открыто чьё-то submenu, остальные кнопки гасим, чтобы зелёным
              // была только та, чьё меню сейчас раскрыто.
              const showActive = isOpen || (openGroup === null && groupActive)

              // Single-item группы (для employee — «Поручения»/«Задачи») показываем
              // иконкой и лейблом самого пункта, чтобы кнопка визуально читалась
              // как вкладка, а не как «папка», которая ничего не открывает.
              const isSingleItem = group.items.length === 1
              const onlyItem = isSingleItem ? group.items[0] : null
              const icon  = onlyItem ? onlyItem.icon : GROUP_ICONS[group.label]
              const label = onlyItem ? (ITEM_LABELS[onlyItem.href] ?? onlyItem.label) : group.label
              const badgeColor = getGroupBadgeColor(group)

              const buttonContent = (
                <>
                  <span
                    data-active={showActive}
                    data-open={isOpen}
                    className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border border-transparent
                               active:scale-[0.92]
                               data-[active=true]:bg-[color:color-mix(in_oklab,var(--color-green)_15%,transparent)]
                               data-[open=true]:border-[color:color-mix(in_oklab,var(--color-green)_35%,transparent)]
                               data-[open=true]:scale-[1.08]"
                  >
                    {icon}
                    {badgeColor && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                        style={{
                          background: badgeColor,
                          boxShadow: '0 0 0 2px var(--color-surface)',
                        }}
                        aria-hidden
                      />
                    )}
                    {isOpen && !isSingleItem && (
                      <ChevronUp
                        size={12}
                        strokeWidth={2.5}
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-green"
                        aria-hidden
                      />
                    )}
                  </span>
                  <span className="text-[10px] font-semibold tracking-wide mt-[3px] leading-tight">
                    {label}
                  </span>
                </>
              )

              const sharedClass = `flex-1 flex flex-col items-center justify-center pt-2 pb-1.5 transition-colors
                                   ${showActive ? 'text-green' : 'text-text-dim'}`

              if (isSingleItem) {
                return (
                  <Link key={group.label} href={group.items[0].href}
                    className={sharedClass}
                    onClick={() => { setOpenGroup(null); haptic.tap() }}>
                    {buttonContent}
                  </Link>
                )
              }

              return (
                <button key={group.label} className={sharedClass} onClick={() => { handleGroupPress(group); haptic.tap() }}>
                  {buttonContent}
                </button>
              )
            }

            // Поиск — отдельная кнопка по центру нижнего бара. Открывает GlobalSearch
            // через кастомное событие — сам компонент GlobalSearch его слушает.
            const searchButton = (
              <button
                key="__search__"
                type="button"
                aria-label="Поиск"
                onClick={() => {
                  setOpenGroup(null)
                  haptic.tap()
                  window.dispatchEvent(new CustomEvent('wag:search:open'))
                }}
                className={`flex-1 flex flex-col items-center justify-center pt-2 pb-1.5 transition-colors
                            ${searchOpen ? 'text-green' : 'text-text-dim'}`}
              >
                <span
                  data-active={searchOpen}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border border-transparent
                             active:scale-[0.92]
                             data-[active=true]:bg-[color:color-mix(in_oklab,var(--color-green)_15%,transparent)]
                             data-[active=true]:border-[color:color-mix(in_oklab,var(--color-green)_25%,transparent)]"
                >
                  <Search size={20} />
                </span>
                <span className="text-[10px] font-semibold tracking-wide mt-[3px] leading-tight">
                  Поиск
                </span>
              </button>
            )

            const mid = Math.ceil(groups.length / 2)
            return [
              ...groups.slice(0, mid).map(renderGroup),
              searchButton,
              ...groups.slice(mid).map(renderGroup),
            ]
          })()}
        </div>
      </nav>
    </>
  )
}

// ─── Строка навигации ─────────────────────────────────────────────────────────
function NavRow({
  item, isActive, pathname, sidebarExpanded, userId,
}: {
  item: NavItem
  isActive: boolean
  pathname: string
  sidebarExpanded: boolean
  userId: string
}) {
  const [childrenOpen, setChildrenOpen] = useState(false)
  const isNotifications = item.href === '/dashboard/notifications'

  if (item.comingSoon) {
    return (
      <div
        data-expanded={sidebarExpanded}
        className="flex items-center rounded-xl border border-transparent text-text-dim opacity-50 cursor-default
                   gap-0 justify-center py-1.5 px-0
                   data-[expanded=true]:gap-3 data-[expanded=true]:justify-start data-[expanded=true]:px-2"
      >
        <div className="w-10 h-10 shrink-0 flex items-center justify-center">{item.icon}</div>
        <span
          className={`text-sm whitespace-nowrap font-medium flex-1 overflow-hidden transition-[max-width,opacity] duration-200
                      ${sidebarExpanded ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0'}`}
        >
          {item.label}
        </span>
        <span
          className={`text-xs font-semibold px-1.5 py-0.5 rounded-md shrink-0 overflow-hidden transition-[max-width,opacity] duration-200
                      ${sidebarExpanded ? 'max-w-20 opacity-100' : 'max-w-0 opacity-0'}`}
          style={{
            background: 'color-mix(in oklab, var(--color-warn-2) 12%, transparent)',
            color:      'var(--color-warn-2)',
            border:     '1px solid color-mix(in oklab, var(--color-warn-2) 25%, transparent)',
          }}
        >
          Скоро
        </span>
      </div>
    )
  }

  const activeStyle: React.CSSProperties = isActive
    ? {
        background:  'color-mix(in oklab, var(--color-green) 15%, transparent)',
        color:       'var(--color-green)',
        borderColor: 'color-mix(in oklab, var(--color-green) 25%, transparent)',
      }
    : {}

  const baseClass = `flex items-center rounded-xl transition-colors border border-transparent
                     ${isActive ? '' : 'text-text-dim hover:text-text hover:bg-surface-2/50'}
                     ${sidebarExpanded ? 'px-2 gap-3 justify-start py-1.5' : 'px-0 gap-0 justify-center py-1.5'}`

  const labelClass = `text-sm whitespace-nowrap font-medium overflow-hidden transition-[max-width,opacity] duration-200
                      ${sidebarExpanded ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0'}`

  if (!item.children) {
    return (
      <Link href={item.href} className={`relative ${baseClass}`} style={activeStyle}>
        <div className="w-10 h-10 shrink-0 flex items-center justify-center">{item.icon}</div>
        <span className={labelClass}>{item.label}</span>
        {isNotifications && (
          <span
            className={
              sidebarExpanded
                ? 'ml-auto shrink-0 mr-1'
                : 'absolute top-1 right-1.5 pointer-events-none'
            }
          >
            <NotificationDot userId={userId} />
          </span>
        )}
      </Link>
    )
  }

  // Пункт с дочерними элементами
  const showOpen = sidebarExpanded && childrenOpen

  return (
    <div>
      <button
        onClick={() => sidebarExpanded && setChildrenOpen(o => !o)}
        className={`w-full ${baseClass} text-left`}
        style={activeStyle}
      >
        <div className="w-10 h-10 shrink-0 flex items-center justify-center">{item.icon}</div>
        <span className={`flex-1 ${labelClass}`}>{item.label}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 mr-1 transition-[max-width,opacity,transform] duration-200
                      ${sidebarExpanded ? 'max-w-4 opacity-100' : 'max-w-0 opacity-0'}
                      ${showOpen ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>

      {/* Дочерние пункты */}
      <div
        className="overflow-hidden transition-[max-height] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ maxHeight: showOpen ? `${item.children.length * 40}px` : '0px' }}
      >
        <div className="mt-0.5 ml-3 flex flex-col gap-0.5 pb-1">
          {item.children.map(child => {
            const childActive = pathname === child.href
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                            ${childActive ? 'text-green' : 'text-text-muted hover:bg-surface-2/50'}`}
                style={childActive
                  ? { background: 'color-mix(in oklab, var(--color-green) 15%, transparent)' }
                  : undefined}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: childActive ? 'var(--color-green)' : 'var(--color-border-2)' }}
                />
                <span className="whitespace-nowrap">{child.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
