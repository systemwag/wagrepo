export default function GanttLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-xl mb-2" style={{ background: 'var(--border-2)' }} />
      <div className="h-4 w-36 rounded mb-8" style={{ background: 'var(--border-2)' }} />
      <div className="card overflow-hidden">
        <div className="flex gap-6 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          {[0,1,2,3].map(i => <div key={i} className="h-4 w-20 rounded" style={{ background: 'var(--border-2)' }} />)}
        </div>
        <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-64 px-4 py-3" style={{ borderRight: '1px solid var(--border)' }}>
            <div className="h-4 w-16 rounded" style={{ background: 'var(--border-2)' }} />
          </div>
          <div className="flex-1 px-4 py-3 flex gap-4">
            {[0,1,2,3,4,5].map(i => <div key={i} className="h-4 flex-1 rounded" style={{ background: 'var(--border-2)' }} />)}
          </div>
        </div>
        {[0,1,2,3,4].map(i => (
          <div key={i} className="flex" style={{ borderBottom: '1px solid rgba(26,38,32,0.5)' }}>
            <div className="w-64 px-4 py-4" style={{ borderRight: '1px solid var(--border)' }}>
              <div className="h-4 w-48 rounded mb-1.5" style={{ background: 'var(--border-2)' }} />
              <div className="h-3 w-32 rounded" style={{ background: 'var(--border-2)' }} />
            </div>
            <div className="flex-1 px-4 py-4 flex items-center">
              <div className="h-7 rounded-lg" style={{ marginLeft: `${i * 12}%`, width: `${20 + i * 8}%`, background: 'var(--border-2)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
