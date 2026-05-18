import { SkeletonStatusBar } from '@/components/ui/Skeleton'

export default function TasksOverviewLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-xl mb-2" style={{ background: 'var(--border-2)' }} />
      <div className="h-4 w-64 rounded mb-4" style={{ background: 'var(--border-2)' }} />
      <SkeletonStatusBar message="Загружаем сводку…" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl px-4 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="h-3 w-16 rounded mb-2" style={{ background: 'var(--border-2)' }} />
            <div className="h-6 w-10 rounded" style={{ background: 'var(--border-2)' }} />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {[0, 1].map(i => (
          <div key={i} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="h-5 w-40 rounded mb-3" style={{ background: 'var(--border-2)' }} />
            <div className="space-y-2">
              {[0, 1, 2].map(j => (
                <div key={j} className="h-10 w-full rounded-lg" style={{ background: 'var(--border-2)' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
