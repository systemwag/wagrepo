'use client'

import { useState, type ReactNode } from 'react'

type Tab = 'planning' | 'tasks'

export default function ProjectTabsClient({
  pipelineView,
  kanbanView,
}: {
  pipelineView: ReactNode
  kanbanView: ReactNode
}) {
  const [tab, setTab] = useState<Tab>('planning')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab nav */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <TabButton active={tab === 'planning'} onClick={() => setTab('planning')}>
          Планирование
        </TabButton>
        <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')}>
          Задачи
        </TabButton>
      </div>

      {/* Content */}
      <div className={`flex-1 min-h-0 ${tab === 'tasks' ? 'flex flex-col' : 'overflow-y-auto'}`}>
        {tab === 'planning' && pipelineView}
        {tab === 'tasks' && (
          <div className="flex flex-1 min-h-0 min-w-0">
            {kanbanView}
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        background: active ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-muted)',
        border: active ? '1px solid var(--border-2)' : '1px solid transparent',
      }}
    >
      {children}
    </button>
  )
}
