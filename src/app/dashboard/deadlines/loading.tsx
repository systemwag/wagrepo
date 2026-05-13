import { SkeletonStatusBar } from '@/components/ui/Skeleton'

export default function DeadlinesLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-64 rounded-xl mb-2" style={{ background: 'var(--border-2)' }} />
      <div className="h-4 w-96 rounded mb-6" style={{ background: 'var(--border-2)' }} />
      <SkeletonStatusBar message="Считаем дедлайны и приоритеты…" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card p-4">
            <div className="h-3 w-20 rounded mb-2" style={{ background: 'var(--border-2)' }} />
            <div className="h-8 w-12 rounded" style={{ background: 'var(--border-2)' }} />
          </div>
        ))}
      </div>

      <div className="card">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="px-6 py-4 flex items-center gap-4"
            style={{ borderBottom: i < 4 ? '1px solid var(--border)' : undefined }}
          >
            <div className="w-3 h-3 rounded-full" style={{ background: 'var(--border-2)' }} />
            <div className="flex-1 min-w-0">
              <div className="h-4 w-2/3 rounded mb-1.5" style={{ background: 'var(--border-2)' }} />
              <div className="h-3 w-1/3 rounded" style={{ background: 'var(--border-2)' }} />
            </div>
            <div className="h-6 w-24 rounded-full" style={{ background: 'var(--border-2)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
