import { SkeletonStatusBar } from '@/components/ui/Skeleton'

export default function NotificationsLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-xl mb-6" style={{ background: 'var(--border-2)' }} />
      <SkeletonStatusBar message="Загружаем уведомления…" />
      <div className="card">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="p-4 flex gap-3"
            style={{ borderBottom: i < 4 ? '1px solid var(--border)' : undefined }}
          >
            <div className="flex-1 min-w-0">
              <div className="h-4 w-1/2 rounded mb-2" style={{ background: 'var(--border-2)' }} />
              <div className="h-3 w-3/4 rounded mb-2" style={{ background: 'var(--border-2)' }} />
              <div className="h-3 w-24 rounded" style={{ background: 'var(--border-2)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
