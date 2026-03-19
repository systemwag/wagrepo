'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut, ChevronDown } from 'lucide-react'
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
  label: string
  href: string
  icon: React.ReactNode
  roles: Profile['role'][]
  children?: ChildItem[]
  comingSoon?: boolean
}

const nav: NavItem[] = [
  {
    label: 'Главная',
    href: '/dashboard',
    roles: ['director', 'manager'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    label: 'Проекты',
    href: '/dashboard/projects',
    roles: ['director', 'manager'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  },
  {
    label: 'Мои задачи',
    href: '/dashboard/tasks',
    roles: ['director', 'manager', 'employee'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  },
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
    label: 'График Ганта',
    href: '/dashboard/gantt',
    roles: ['director', 'manager'],
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
  },
  {
    label: 'Аналитика',
    href: '/dashboard/analytics',
    roles: ['director'],
    comingSoon: true,
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    label: 'Мероприятия',
    href: '/dashboard/events',
    roles: ['director', 'manager'],
    comingSoon: true,
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
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
    <aside
      className="fixed left-0 top-0 h-full z-40 flex flex-col py-3"
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
      <div className="flex-shrink-0 relative px-3 mb-3" style={{ height: '80px' }}>
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
        {visibleNav.map(item => {
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
  const isChildActive = item.children.some(c => pathname === c.href)
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
