export default function ProjectLoading() {
  return (
    <div className="animate-pulse h-full flex flex-col">
      <div className="mb-6">
        <div className="h-4 w-40 rounded mb-3" style={{ background: 'var(--border-2)' }} />
        <div className="h-8 w-96 rounded-xl mb-3" style={{ background: 'var(--border-2)' }} />
        <div className="flex gap-3">
          <div className="h-6 w-20 rounded-full" style={{ background: 'var(--border-2)' }} />
          <div className="h-6 w-32 rounded" style={{ background: 'var(--border-2)' }} />
        </div>
      </div>
      <div className="flex gap-4 flex-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex-shrink-0 w-72">
            <div className="h-5 w-28 rounded mb-3" style={{ background: 'var(--border-2)' }} />
            <div className="space-y-2">
              {[0, 1].map(j => (
                <div key={j} className="card rounded-xl p-3">
                  <div className="h-4 w-full rounded mb-2" style={{ background: 'var(--border-2)' }} />
                  <div className="h-4 w-2/3 rounded mb-3" style={{ background: 'var(--border-2)' }} />
                  <div className="h-5 w-16 rounded-full" style={{ background: 'var(--border-2)' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
