'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut, ChevronDown, Home, FolderOpen, Users, ClipboardList, BarChart3, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  full_name: string
  role: 'director' | 'manager' | 'employee'
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

const nav: NavEntry[] = [
  // ── Обзор ────────────────────────────────────────────────────────────────
  {
    label: 'Главная',
    href: '/dashboard',
    roles: ['director', 'manager'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    label: 'Дедлайны',
    href: '/dashboard/deadlines',
    roles: ['director'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={1.6} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 7v5l3 3" /></svg>,
  },

  // ── Проекты ───────────────────────────────────────────────────────────────
  { type: 'divider', label: 'Проекты', roles: ['director', 'manager'] },
  {
    label: 'Проекты',
    href: '/dashboard/projects',
    roles: ['director', 'manager'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  },
  {
    label: 'График Ганта',
    href: '/dashboard/gantt',
    roles: ['director', 'manager'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
  },

  // ── Команда ───────────────────────────────────────────────────────────────
  { type: 'divider', label: 'Команда', roles: ['director'] },
  {
    label: 'Поручения',
    href: '/dashboard/assign',
    roles: ['director'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
    children: [
      { label: 'Новое поручение', href: '/dashboard/assign/new' },
      { label: 'Журнал',         href: '/dashboard/assign' },
    ],
  },
  {
    label: 'Сотрудники',
    href: '/dashboard/employees',
    roles: ['director'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    label: 'Мероприятия',
    href: '/dashboard/events',
    roles: ['director', 'manager', 'employee'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },

  // ── Личное ────────────────────────────────────────────────────────────────
  { type: 'divider', label: 'Личное', roles: ['director', 'manager', 'employee'] },
  {
    label: 'Поручения',
    href: '/dashboard/assignments',
    roles: ['manager', 'employee'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  },
  {
    label: 'Работа по проекту',
    href: '/dashboard/tasks',
    roles: ['director', 'manager', 'employee'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  },
  {
    label: 'Дейли-отчёт',
    href: '/dashboard/daily',
    roles: ['director', 'manager', 'employee'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  },
  {
    label: 'Уведомления',
    href: '/dashboard/notifications',
    roles: ['director', 'manager', 'employee'],
    icon: <Bell className="w-6 h-6" strokeWidth={1.6} />,
  },

  // ── Аналитика ─────────────────────────────────────────────────────────────
  { type: 'divider', label: 'Аналитика', roles: ['director'] },
  {
    label: 'Пульс компании',
    href: '/dashboard/activity',
    roles: ['director'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  },
  {
    label: 'Аналитика',
    href: '/dashboard/analytics',
    roles: ['director'],
    comingSoon: true,
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },

  // ── Тест ──────────────────────────────────────────────────────────────────
  { type: 'divider', label: 'Разработка', roles: ['director', 'manager', 'employee'] },
  {
    label: '[ТЕСТ] Модули',
    href: '/dashboard/test/quick-tasks',
    roles: ['director', 'manager', 'employee'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    children: [
      { label: 'Быстрые поручения', href: '/dashboard/test/quick-tasks' },
      { label: 'Светофор просрочек', href: '/dashboard/test/deadlines' },
      { label: 'Пульс компании', href: '/dashboard/test/activity-feed' },
      { label: 'Перекличка', href: '/dashboard/test/handover' },
      { label: 'Дейли-отчет', href: '/dashboard/test/daily-report' },
      { label: 'Шаблоны проектов', href: '/dashboard/test/templates' },
      { label: 'Загрузка сотрудников', href: '/dashboard/test/resource-map' },
      { label: 'Согласования', href: '/dashboard/test/document-approvals' },
      { label: 'Аналитика узких', href: '/dashboard/test/bottlenecks' },
      { label: 'Фокус / WIP', href: '/dashboard/test/focus-mode' },
    ],
  },
]

const roleLabel: Record<Profile['role'], string> = {
  director: 'Директор',
  manager:  'Менеджер',
  employee: 'Сотрудник',
}

export default function Sidebar({ profile }: { profile: Profile }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [expanded, setExpanded] = useState(false)
  const visibleNav = nav.filter(item => item.roles.includes(profile.role))

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
    <aside
      className="fixed left-0 top-0 h-full z-40 flex-col py-3 hidden md:flex"
      style={{
        width: expanded ? '220px' : '56px',
        transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Лого */}
      <div className="flex-shrink-0 relative px-3 mb-3 overflow-hidden" style={{ height: '80px' }}>
        {/* W-бейдж — виден только в свёрнутом сайдбаре */}
        <div
          className="absolute inset-y-0 left-3 flex items-center"
          style={{ opacity: expanded ? 0 : 1, transition: 'opacity 160ms ease', pointerEvents: expanded ? 'none' : 'auto' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base"
            style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.35)' }}
          >
            W
          </div>
        </div>
        {/* Логотип — виден при раскрытии */}
        <div
          className="absolute inset-x-3 flex items-center"
          style={{ top: '12px', bottom: '12px', opacity: expanded ? 1 : 0, transition: 'opacity 200ms ease', pointerEvents: expanded ? 'auto' : 'none' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="WAG" style={{ width: '190px', height: 'auto' }} />
        </div>
      </div>

      {/* Разделитель */}
      <div className="mx-3 mb-2 flex-shrink-0" style={{ height: '1px', background: 'var(--border)' }} />

      {/* Навигация */}
      <nav className="flex flex-col gap-0.5 flex-1 px-1.5 overflow-y-auto overflow-x-hidden">
        {visibleNav.map((entry, idx) => {
          if (entry.type === 'divider') {
            return (
              <div key={`div-${idx}`} className="flex items-center gap-2 px-2 mt-2 mb-0.5" style={{ minHeight: '24px' }}>
                <div style={{ height: '1px', background: 'var(--border)', flex: expanded ? '0 0 8px' : '1' }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all"
                  style={{
                    color: 'var(--text-dim)',
                    maxWidth: expanded ? '120px' : '0px',
                    opacity: expanded ? 1 : 0,
                    transition: 'max-width 200ms ease, opacity 150ms ease',
                  }}
                >
                  {entry.label}
                </span>
                <div style={{ height: '1px', background: 'var(--border)', flex: 1 }} />
              </div>
            )
          }

          const item = entry as NavItem
          const isGroupActive = item.href !== '/dashboard' && pathname.startsWith(item.href)
          const isActive = item.children
            ? isGroupActive
            : (pathname === item.href || (item.href !== '/dashboard' && isGroupActive))

          return (
            <NavRow
              key={item.href}
              item={item}
              isActive={isActive}
              pathname={pathname}
              sidebarExpanded={expanded}
            />
          )
        })}
      </nav>

      {/* Низ: профиль + выход */}
      <div className="px-1.5 flex-shrink-0">
        <div className="mx-2 mb-2" style={{ height: '1px', background: 'var(--border)' }} />

        {/* Профиль */}
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl" style={{ minHeight: '40px' }}>
          <div
            className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div
            style={{
              opacity: expanded ? 1 : 0,
              transition: 'opacity 150ms ease',
              minWidth: 0,
            }}
          >
            <p className="text-xs font-semibold whitespace-nowrap truncate" style={{ color: 'var(--text)' }}>
              {profile.full_name}
            </p>
            <p className="text-xs whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>
              {roleLabel[profile.role]}
            </p>
          </div>
        </div>

        {/* Выход */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-2 py-1.5 rounded-xl transition-colors"
          style={{ color: 'var(--text-dim)', minHeight: '40px' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)'
            ;(e.currentTarget as HTMLElement).style.color = '#f87171'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
          }}
        >
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
            <LogOut size={17} />
          </div>
          <span
            className="text-sm whitespace-nowrap"
            style={{ opacity: expanded ? 1 : 0, transition: 'opacity 150ms ease' }}
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
  'Обзор':     <Home size={20} />,
  'Проекты':   <FolderOpen size={20} />,
  'Команда':   <Users size={20} />,
  'Личное':    <ClipboardList size={20} />,
  'Аналитика': <BarChart3 size={20} />,
}

const ITEM_LABELS: Record<string, string> = {
  '/dashboard':            'Главная',
  '/dashboard/deadlines':  'Дедлайны',
  '/dashboard/projects':   'Проекты',
  '/dashboard/gantt':      'Ганта',
  '/dashboard/assign':       'Поручения',
  '/dashboard/assign/new':   'Поручить',
  '/dashboard/assignments':  'Поручения',
  '/dashboard/employees':    'Команда',
  '/dashboard/events':       'События',
  '/dashboard/tasks':          'Задачи',
  '/dashboard/daily':          'Дейли',
  '/dashboard/notifications':  'Уведомления',
  '/dashboard/activity':   'Пульс',
  '/dashboard/analytics':  'Аналитика',
}

type MobileGroup = { label: string; items: NavItem[] }

function buildMobileGroups(role: Profile['role']): MobileGroup[] {
  const result: MobileGroup[] = []
  let currentLabel = 'Обзор'
  let currentItems: NavItem[] = []

  for (const entry of nav) {
    if (entry.type === 'divider') {
      if (entry.label === 'Разработка') break
      if (currentItems.length > 0) result.push({ label: currentLabel, items: currentItems })
      currentLabel = entry.roles.includes(role) ? entry.label : ''
      currentItems = []
    } else {
      if (!entry.roles.includes(role)) continue
      if (entry.href.startsWith('/dashboard/test')) continue
      if (currentLabel) currentItems.push(entry)
    }
  }
  if (currentLabel && currentItems.length > 0) result.push({ label: currentLabel, items: currentItems })
  return result
}

function MobileBottomNav({ profile, pathname }: { profile: Profile; pathname: string }) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const groups = buildMobileGroups(profile.role)
  const submenuItems = groups.find(g => g.label === openGroup)?.items ?? []

  function handleGroupPress(group: MobileGroup) {
    if (group.items.length === 1) {
      setOpenGroup(null)
      return  // Link will handle navigation
    }
    setOpenGroup(prev => prev === group.label ? null : group.label)
  }

  return (
    <>
      {/* Затемняющий оверлей */}
      {openGroup && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={() => setOpenGroup(null)}
        />
      )}

      {/* Всплывающая панель — плоский список */}
      <div
        className="fixed left-0 right-0 z-[49] md:hidden px-3"
        style={{
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          transform: openGroup ? 'translateY(0)' : 'translateY(12px)',
          opacity: openGroup ? 1 : 0,
          pointerEvents: openGroup ? 'auto' : 'none',
          transition: 'transform 260ms cubic-bezier(0.34,1.3,0.64,1), opacity 180ms ease',
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
            borderRadius: '16px',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.45)',
            display: 'grid',
            gridTemplateColumns: submenuItems.length <= 2 ? '1fr' : 'repeat(2, 1fr)',
            gap: '6px',
            padding: '10px',
          }}
        >
          {submenuItems.map((item, i) => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
            const label = ITEM_LABELS[item.href] ?? item.label

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpenGroup(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: isActive ? 'var(--green-glow)' : 'var(--surface-2)',
                  border: `1px solid ${isActive ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
                  color: isActive ? 'var(--green)' : 'var(--text-muted)',
                  animation: openGroup ? `pop-in 280ms cubic-bezier(0.34,1.4,0.64,1) ${i * 35}ms both` : 'none',
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: isActive ? 'rgba(34,197,94,0.2)' : 'var(--surface)',
                  border: `1px solid ${isActive ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
                }}>
                  {item.icon}
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
                {isActive && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--green)', flexShrink: 0,
                  }} />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Нижний бар с группами */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden mobile-nav-bar"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
      >
        <div className="flex">
          {groups.map(group => {
            const groupActive = group.items.some(item =>
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            )
            const isOpen = openGroup === group.label
            const icon = GROUP_ICONS[group.label]

            const buttonContent = (
              <>
                <span style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: (groupActive || isOpen) ? 'var(--green-glow)' : 'transparent',
                  border: `1px solid ${isOpen ? 'rgba(34,197,94,0.35)' : 'transparent'}`,
                  transform: isOpen ? 'scale(1.08)' : 'scale(1)',
                  transition: 'all 200ms ease',
                }}>
                  {icon}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  marginTop: '3px',
                  lineHeight: 1.2,
                }}>
                  {group.label}
                </span>
              </>
            )

            const sharedStyle: React.CSSProperties = {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: '8px',
              paddingBottom: '6px',
              color: (groupActive || isOpen) ? 'var(--green)' : 'var(--text-dim)',
              transition: 'color 150ms ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }

            // Группа с 1 пунктом → прямая ссылка
            if (group.items.length === 1) {
              return (
                <Link key={group.label} href={group.items[0].href} style={sharedStyle}
                  onClick={() => setOpenGroup(null)}>
                  {buttonContent}
                </Link>
              )
            }

            return (
              <button key={group.label} style={sharedStyle} onClick={() => handleGroupPress(group)}>
                {buttonContent}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

// ─── Строка навигации ─────────────────────────────────────────────────────────
function NavRow({
  item, isActive, pathname, sidebarExpanded,
}: {
  item: NavItem
  isActive: boolean
  pathname: string
  sidebarExpanded: boolean
}) {
  const [childrenOpen, setChildrenOpen] = useState(false)

  const activeStyle = {
    background: 'var(--green-glow)',
    color: 'var(--green)',
    border: '1px solid rgba(34,197,94,0.2)',
  }
  const inactiveStyle = {
    color: 'var(--text-dim)',
    border: '1px solid transparent',
  }
  const comingSoonStyle = {
    color: 'var(--text-dim)',
    border: '1px solid transparent',
    opacity: 0.5,
    cursor: 'default' as const,
  }

  if (item.comingSoon) {
    return (
      <div
        className="flex items-center gap-3 px-2 py-1.5 rounded-xl"
        style={comingSoonStyle}
      >
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
          {item.icon}
        </div>
        <span
          className="text-sm whitespace-nowrap font-medium flex-1"
          style={{ opacity: sidebarExpanded ? 1 : 0, transition: 'opacity 150ms ease' }}
        >
          {item.label}
        </span>
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
          style={{
            opacity: sidebarExpanded ? 1 : 0,
            transition: 'opacity 150ms ease',
            background: 'rgba(234,179,8,0.12)',
            color: '#ca8a04',
            border: '1px solid rgba(234,179,8,0.2)',
          }}
        >
          Скоро
        </span>
      </div>
    )
  }

  if (!item.children) {
    return (
      <Link
        href={item.href}
        className="flex items-center gap-3 px-2 py-1.5 rounded-xl transition-colors"
        style={isActive ? activeStyle : inactiveStyle}
        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)' }}
      >
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
          {item.icon}
        </div>
        <span
          className="text-sm whitespace-nowrap font-medium"
          style={{ opacity: sidebarExpanded ? 1 : 0, transition: 'opacity 150ms ease' }}
        >
          {item.label}
        </span>
      </Link>
    )
  }

  // Пункт с дочерними элементами
  const _isChildActive = item.children.some(c => pathname === c.href)
  const showOpen = sidebarExpanded && childrenOpen

  return (
    <div>
      <button
        onClick={() => sidebarExpanded && setChildrenOpen(o => !o)}
        className="w-full flex items-center gap-3 px-2 py-1.5 rounded-xl transition-colors"
        style={isActive ? activeStyle : inactiveStyle}
        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)' }}
      >
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
          {item.icon}
        </div>
        <span
          className="text-sm whitespace-nowrap font-medium flex-1 text-left"
          style={{ opacity: sidebarExpanded ? 1 : 0, transition: 'opacity 150ms ease' }}
        >
          {item.label}
        </span>
        <ChevronDown
          size={14}
          className="flex-shrink-0 mr-1 transition-transform duration-200"
          style={{
            opacity: sidebarExpanded ? 0.6 : 0,
            transform: showOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'opacity 150ms ease, transform 200ms ease',
          }}
        />
      </button>

      {/* Дочерние пункты */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: showOpen ? `${item.children.length * 40}px` : '0px',
          transition: 'max-height 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="mt-0.5 ml-3 flex flex-col gap-0.5 pb-1">
          {item.children.map(child => {
            const childActive = pathname === child.href
            return (
              <Link
                key={child.href}
                href={child.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={childActive ? {
                  background: 'var(--green-glow)',
                  color: 'var(--green)',
                } : {
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={e => { if (!childActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { if (!childActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: childActive ? 'var(--green)' : 'var(--border-2)' }}
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
