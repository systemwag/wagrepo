import { SkeletonStatusBar } from '@/components/ui/Skeleton'

export default function DailyTeamLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-xl mb-2" style={{ background: 'var(--border-2)' }} />
      <div className="h-4 w-40 rounded mb-6" style={{ background: 'var(--border-2)' }} />
      <SkeletonStatusBar message="Собираем отчёты команды за сегодня…" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl" style={{ background: 'var(--border-2)' }} />
              <div className="flex-1">
                <div className="h-4 w-40 rounded mb-1.5" style={{ background: 'var(--border-2)' }} />
                <div className="h-3 w-24 rounded" style={{ background: 'var(--border-2)' }} />
              </div>
              <div className="h-6 w-20 rounded-full" style={{ background: 'var(--border-2)' }} />
            </div>
            <div className="h-3 w-full rounded mb-1.5" style={{ background: 'var(--border-2)' }} />
            <div className="h-3 w-2/3 rounded" style={{ background: 'var(--border-2)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
