import { SkeletonStatusBar } from '@/components/ui/Skeleton'

export default function NewProjectLoading() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-8 w-56 rounded-xl mb-2" style={{ background: 'var(--border-2)' }} />
      <div className="h-4 w-80 rounded mb-6" style={{ background: 'var(--border-2)' }} />
      <SkeletonStatusBar message="Подготавливаем форму создания проекта…" />
      <div className="card p-6 space-y-4">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i}>
            <div className="h-3 w-32 rounded mb-2" style={{ background: 'var(--border-2)' }} />
            <div className="h-10 w-full rounded-xl" style={{ background: 'var(--border-2)' }} />
          </div>
        ))}
        <div className="h-11 w-44 rounded-xl mt-2" style={{ background: 'var(--border-2)' }} />
      </div>
    </div>
  )
}
