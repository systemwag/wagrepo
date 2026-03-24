export default function EventsLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-36 rounded-xl mb-2" style={{ background: 'var(--border-2)' }} />
          <div className="h-4 w-52 rounded"         style={{ background: 'var(--border-2)' }} />
        </div>
        <div className="h-10 w-44 rounded-xl"       style={{ background: 'var(--border-2)' }} />
      </div>
      <div className="card overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-center gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="h-6 w-6 rounded-lg"     style={{ background: 'var(--border-2)' }} />
          <div className="h-6 w-36 rounded"       style={{ background: 'var(--border-2)' }} />
          <div className="h-6 w-6 rounded-lg"     style={{ background: 'var(--border-2)' }} />
        </div>
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="py-2.5 flex justify-center">
              <div className="h-3 w-6 rounded" style={{ background: 'var(--border-2)' }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              style={{
                minHeight: 110,
                borderRight:  (i + 1) % 7 !== 0 ? '1px solid var(--border)' : undefined,
                borderBottom: i < 28             ? '1px solid var(--border)' : undefined,
              }}
            >
              <div className="px-2 pt-2">
                <div className="w-6 h-6 rounded-full" style={{ background: 'var(--border-2)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
