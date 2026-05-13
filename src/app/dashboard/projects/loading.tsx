import { SkeletonStatusBar } from '@/components/ui/Skeleton'

const BAR = { background: 'var(--color-border-2)' } as const

function CardSkeleton() {
  return (
    <div className="card relative px-4 py-3 md:px-6 md:py-4 overflow-hidden">
      {/* Цветная полоса слева */}
      <span className="absolute left-0 top-0 bottom-0 w-1" style={BAR} />

      <div className="pl-2 md:pl-3 flex flex-col gap-3">
        {/* Шапка: название + статус + дедлайн */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-4 w-44 md:w-64 rounded" style={BAR} />
              <div className="h-5 w-20 rounded-full" style={BAR} />
            </div>
            <div className="h-3 w-32 md:w-52 rounded mt-2" style={BAR} />
          </div>
          <div className="text-right shrink-0 hidden md:block space-y-1.5">
            <div className="h-3 w-16 rounded ml-auto" style={BAR} />
            <div className="h-4 w-20 rounded ml-auto" style={BAR} />
            <div className="h-3 w-24 rounded ml-auto" style={BAR} />
          </div>
        </div>

        {/* Прогресс этапов */}
        <div className="flex w-full gap-1 h-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-1 rounded-sm" style={BAR} />
          ))}
        </div>

        {/* Подпись и нижняя мета */}
        <div className="flex items-center gap-3">
          <div className="h-3 w-20 rounded" style={BAR} />
          <div className="h-3 w-16 rounded" style={BAR} />
          <div className="h-5 w-5 rounded-full ml-auto" style={BAR} />
        </div>
      </div>
    </div>
  )
}

export default function ProjectsLoading() {
  return (
    <div className="animate-pulse">
      {/* Хедер */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="h-8 w-40 rounded-xl" style={BAR} />
        <div className="h-10 w-36 rounded-xl" style={BAR} />
      </div>

      {/* Toolbar (search + sort + pills) */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-10 flex-1 rounded-xl" style={BAR} />
          <div className="h-10 w-32 rounded-xl hidden sm:block" style={BAR} />
          <div className="h-10 w-24 rounded-xl md:hidden" style={BAR} />
        </div>
        <div className="hidden md:flex items-center gap-1.5">
          {[60, 110, 90, 80, 110].map((w, i) => (
            <div key={i} className="h-8 rounded-full" style={{ ...BAR, width: w }} />
          ))}
        </div>
      </div>

      <SkeletonStatusBar message="Загружаем список проектов…" />

      {/* Карточки */}
      <div className="grid grid-cols-1 gap-3">
        {[0, 1, 2, 3, 4, 5].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}
