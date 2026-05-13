import { SkeletonStatusBar } from '@/components/ui/Skeleton'

export default function DailyLoading() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-8 w-48 rounded-xl mb-2" style={{ background: 'var(--border-2)' }} />
      <div className="h-4 w-72 rounded mb-6" style={{ background: 'var(--border-2)' }} />
      <SkeletonStatusBar message="Загружаем ваш дейли-отчёт и историю…" />

      <div className="card p-6 mb-4 space-y-4">
        <div className="h-5 w-40 rounded" style={{ background: 'var(--border-2)' }} />
        <div className="h-24 w-full rounded-xl" style={{ background: 'var(--border-2)' }} />
        <div className="h-24 w-full rounded-xl" style={{ background: 'var(--border-2)' }} />
      </div>

      <div className="card p-6 space-y-3">
        <div className="h-4 w-32 rounded" style={{ background: 'var(--border-2)' }} />
        {[0, 1, 2].map(i => (
          <div key={i} className="h-14 w-full rounded-xl" style={{ background: 'var(--border-2)' }} />
        ))}
      </div>
    </div>
  )
}
