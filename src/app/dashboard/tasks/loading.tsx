export default function TasksLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-36 rounded-xl mb-2" style={{ background: 'var(--border-2)' }} />
      <div className="h-4 w-28 rounded mb-8" style={{ background: 'var(--border-2)' }} />
      <div className="card">
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="h-5 w-20 rounded" style={{ background: 'var(--border-2)' }} />
        </div>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: i < 3 ? '1px solid var(--border)' : undefined }}>
            <div>
              <div className="h-4 w-64 rounded mb-1.5" style={{ background: 'var(--border-2)' }} />
              <div className="h-3 w-40 rounded" style={{ background: 'var(--border-2)' }} />
            </div>
            <div className="flex gap-3">
              <div className="h-4 w-16 rounded" style={{ background: 'var(--border-2)' }} />
              <div className="h-6 w-24 rounded-full" style={{ background: 'var(--border-2)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
