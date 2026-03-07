export default function ProjectsLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-32 rounded-xl mb-2" style={{ background: 'var(--border-2)' }} />
          <div className="h-4 w-24 rounded" style={{ background: 'var(--border-2)' }} />
        </div>
        <div className="h-10 w-36 rounded-xl" style={{ background: 'var(--border-2)' }} />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card px-6 py-5 flex items-center justify-between">
            <div>
              <div className="h-5 w-72 rounded mb-2" style={{ background: 'var(--border-2)' }} />
              <div className="h-3 w-40 rounded" style={{ background: 'var(--border-2)' }} />
            </div>
            <div className="h-6 w-20 rounded-full" style={{ background: 'var(--border-2)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
