import { Wrench, Database, FolderOpen, CheckSquare, Send, Calendar, Bell, Activity, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import PushTestPanel from '@/components/PushTestPanel'
import WipeAllButton from './WipeAllButton'
import { getDbOverview, type DbOverview } from '@/lib/actions/admin'

export const dynamic = 'force-dynamic'

const TABLE_LINKS: { key: keyof DbOverview; label: string; href: string; icon: React.ComponentType<{ size?: number }>; color: string }[] = [
  { key: 'projects',         label: 'Проекты',                href: '/dashboard/admin/projects', icon: FolderOpen,  color: '#22c55e' },
  { key: 'project_tasks',    label: 'Задачи проектов',        href: '/dashboard/admin/tasks?kind=project', icon: CheckSquare, color: '#60a5fa' },
  { key: 'direct_tasks',     label: 'Прямые поручения',       href: '/dashboard/admin/tasks?kind=direct',  icon: Send,        color: '#a78bfa' },
  { key: 'events',           label: 'События',                href: '/dashboard/admin/events',   icon: Calendar,    color: '#06b6d4' },
  { key: 'notifications',    label: 'Уведомления',            href: '/dashboard/admin/notifications', icon: Bell,   color: '#f59e0b' },
  { key: 'activity_log',     label: 'Лог активности',         href: '/dashboard/admin/activity', icon: Activity,    color: '#fb923c' },
]

const READ_ONLY_TABLES: { label: string; key: keyof DbOverview }[] = [
  { label: 'Этапы проектов', key: 'project_stages' },
  { label: 'Дейли-отчёты',    key: 'daily_reports' },
  { label: 'Документы',       key: 'documents' },
  { label: 'Push-подписки',   key: 'push_subscriptions' },
]

export default async function AdminPage() {
  const overview = await getDbOverview()

  return (
    <div>
      <PageHeader
        icon={<Wrench size={18} />}
        iconTone="green"
        title="Админ-инструменты"
        subtitle="Служебные функции — только для admin. Обзор БД, чистка тестовых записей, диагностика."
      />

      <div className="space-y-8">
        {/* ── Обзор БД ── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 text-text-muted flex items-center gap-2">
            <Database size={14} />
            Содержимое базы
          </h2>

          {!overview ? (
            <p className="text-sm text-text-muted">Не удалось загрузить статистику</p>
          ) : (
            <>
              {/* Таблицы с возможностью управления */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {TABLE_LINKS.map(({ key, label, href, icon: Icon, color }) => (
                  <Link
                    key={key}
                    href={href}
                    className="card p-4 hover-border transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `color-mix(in oklab, ${color} 18%, transparent)`,
                          color,
                          border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{label}</p>
                        <p className="text-2xl font-bold num mt-1" style={{ color }}>
                          {overview[key]}
                        </p>
                        <p className="text-xs text-text-dim mt-1 group-hover:text-text-muted transition-colors">
                          Открыть управление →
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Read-only счётчики */}
              <div
                className="card p-4"
                style={{ background: 'var(--color-surface-2)' }}
              >
                <p className="text-xs uppercase tracking-wider mb-2 text-text-dim">
                  Связанные таблицы (управляются автоматически вместе с родителями)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {READ_ONLY_TABLES.map(({ label, key }) => (
                    <div key={key as string}>
                      <p className="text-xs text-text-muted">{label}</p>
                      <p className="text-lg font-semibold num text-text">{overview[key]}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── Опасная зона ── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--color-danger)' }}>
            <AlertTriangle size={14} />
            Опасная зона
          </h2>
          <p className="text-xs text-text-muted mb-3 max-w-2xl leading-relaxed">
            Сбросить рабочие данные одним кликом — удобно во время разработки.
            Пользователи, шаблоны проектов и push-подписки сохраняются.
          </p>
          <WipeAllButton />
        </section>

        {/* ── Push-уведомления (диагностика) ── */}
        <section className="max-w-3xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 text-text-muted">
            Диагностика
          </h2>
          <PushTestPanel />
        </section>
      </div>
    </div>
  )
}
