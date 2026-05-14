export default function Loading() {
  return (
    <div className="@container animate-pulse">
      <div className="h-16 mb-6 rounded-xl" style={{ background: 'var(--color-surface)' }} />
      <div className="h-12 mb-4 rounded-xl" style={{ background: 'var(--color-surface)' }} />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl" style={{ background: 'var(--color-surface)' }} />
        ))}
      </div>
    </div>
  )
}
