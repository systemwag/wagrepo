'use client'

import { type ReactNode } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Workflow, ListChecks, History } from 'lucide-react'

type Tab = 'stages' | 'tasks' | 'progress'

export default function ProjectTabsClient({
  pipelineView,
  tasksView,
  progressView,
}: {
  pipelineView: ReactNode
  tasksView: ReactNode
  progressView: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()

  // Источник истины — URL: не теряем выбор при router.refresh() (а его много в Kanban).
  // Принимаем старое значение 'planning' как стейджи — для backward compat со ссылками в активити-логе.
  const raw = search.get('view')
  const tab: Tab =
    raw === 'tasks'    ? 'tasks'    :
    raw === 'progress' ? 'progress' :
                         'stages'

  function setTab(next: Tab) {
    const params = new URLSearchParams(search.toString())
    if (next === 'stages') params.delete('view')
    else params.set('view', next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab nav */}
      <div
        className="flex gap-1 mb-4 p-1 rounded-xl w-fit"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <TabButton active={tab === 'stages'} onClick={() => setTab('stages')} icon={<Workflow size={15} strokeWidth={1.8} />}>
          Этапы
        </TabButton>
        <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')} icon={<ListChecks size={15} strokeWidth={1.8} />}>
          Задачи
        </TabButton>
        <TabButton active={tab === 'progress'} onClick={() => setTab('progress')} icon={<History size={15} strokeWidth={1.8} />}>
          Прогресс
        </TabButton>
      </div>

      {/* Content */}
      <div className={`flex-1 min-h-0 ${tab === 'tasks' ? 'flex flex-col' : 'overflow-y-auto'}`}>
        {tab === 'stages' && pipelineView}
        {tab === 'tasks' && (
          <div className="flex flex-1 min-h-0 min-w-0">
            {tasksView}
          </div>
        )}
        {tab === 'progress' && progressView}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        background: active ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--color-green)' : 'var(--text-muted)',
        border: active
          ? '1px solid color-mix(in oklab, var(--color-green) 30%, transparent)'
          : '1px solid transparent',
      }}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  )
}
