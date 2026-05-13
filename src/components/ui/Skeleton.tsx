// Переиспользуемые скелетоны загрузки.
// Любой блок отрисовывается мгновенно — пользователь видит структуру страницы,
// пока на сервере выполняются запросы к Supabase.

const BAR = { background: 'var(--border-2)' } as const

export function SkeletonBar({ w = 'w-32', h = 'h-4', className = '' }: { w?: string; h?: string; className?: string }) {
  return <div className={`${h} ${w} rounded ${className}`} style={BAR} />
}

export function SkeletonHeader({ title = 'w-48', subtitle = 'w-32' }: { title?: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <div className="h-8 rounded-xl mb-2" style={{ ...BAR, width: 'auto' }}>
        <div className={`h-8 ${title} rounded-xl`} style={BAR} />
      </div>
      <div className={`h-4 ${subtitle} rounded mt-2`} style={BAR} />
    </div>
  )
}

export function SkeletonRows({ count = 4, withBadge = true }: { count?: number; withBadge?: boolean }) {
  return (
    <div className="card">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: i < count - 1 ? '1px solid var(--border)' : undefined }}
        >
          <div className="flex-1 min-w-0">
            <div className="h-4 w-2/3 max-w-md rounded mb-1.5" style={BAR} />
            <div className="h-3 w-1/3 max-w-xs rounded" style={BAR} />
          </div>
          {withBadge && <div className="h-6 w-24 rounded-full" style={BAR} />}
        </div>
      ))}
    </div>
  )
}

export function SkeletonStatusBar({ message = 'Загрузка данных…' }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
      <span
        className="inline-block w-3 h-3 rounded-full animate-pulse"
        style={{ background: 'var(--green)', boxShadow: '0 0 8px rgba(34,197,94,0.4)' }}
      />
      {message}
    </div>
  )
}

/** Универсальный скелетон списка: заголовок + статус-бар + строки. */
export default function PageListSkeleton({
  title = 'w-48',
  subtitle = 'w-32',
  rows = 4,
  message = 'Загрузка данных из БД…',
}: {
  title?: string
  subtitle?: string
  rows?: number
  message?: string
}) {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className={`h-8 ${title} rounded-xl mb-2`} style={BAR} />
        <div className={`h-4 ${subtitle} rounded`} style={BAR} />
      </div>
      <SkeletonStatusBar message={message} />
      <SkeletonRows count={rows} />
    </div>
  )
}
