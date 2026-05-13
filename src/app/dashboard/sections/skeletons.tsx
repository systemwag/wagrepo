// Лёгкие скелетоны под Suspense-блоки главной.

const BAR = { background: 'var(--color-border-2)' } as const

export function StatsSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6 animate-pulse">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4 px-4 py-4 md:px-5">
          <div className="w-10 h-10 rounded-xl shrink-0" style={BAR} />
          <div className="flex-1">
            <div className="h-6 w-12 rounded mb-1.5" style={BAR} />
            <div className="h-3 w-24 rounded" style={BAR} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardListSkeleton({ rows = 3, title = 'w-44' }: { rows?: number; title?: string }) {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4 border-b border-border">
        <div className="w-5 h-5 rounded" style={BAR} />
        <div className={`h-5 ${title} rounded`} style={BAR} />
      </div>
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 @md:px-6"
            style={{ borderBottom: i < rows - 1 ? '1px solid var(--color-border)' : undefined }}
          >
            <div className="w-9 h-9 rounded-xl shrink-0" style={BAR} />
            <div className="flex-1">
              <div className="h-4 w-2/3 rounded mb-1.5" style={BAR} />
              <div className="h-3 w-1/3 rounded" style={BAR} />
            </div>
            <div className="h-6 w-20 rounded-full" style={BAR} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CtaSkeleton() {
  return (
    <div className="h-14 w-full rounded-2xl mb-5 animate-pulse" style={BAR} />
  )
}
