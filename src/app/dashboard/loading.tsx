export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-xl mb-2" style={{ background: 'var(--border-2)' }} />
      <div className="h-4 w-32 rounded-lg mb-8" style={{ background: 'var(--border-2)' }} />
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map(i => (
          <div key={i} className="card p-5">
            <div className="h-4 w-28 rounded mb-3" style={{ background: 'var(--border-2)' }} />
            <div className="h-8 w-12 rounded" style={{ background: 'var(--border-2)' }} />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="h-5 w-36 rounded" style={{ background: 'var(--border-2)' }} />
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: i < 2 ? '1px solid var(--border)' : undefined }}>
            <div className="h-4 w-64 rounded" style={{ background: 'var(--border-2)' }} />
            <div className="h-6 w-20 rounded-full" style={{ background: 'var(--border-2)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
