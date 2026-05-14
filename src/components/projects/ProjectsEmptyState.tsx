import Link from 'next/link'
import { FolderOpen, Search, UserCheck } from 'lucide-react'

export type EmptyKind = 'no-projects' | 'no-results' | 'no-assigned'

type Props = {
  kind: EmptyKind
  canCreate?: boolean
  onReset?: () => void
}

const COPY: Record<EmptyKind, {
  icon: React.ReactNode
  title: string
  hint: string
}> = {
  'no-projects': {
    icon: <FolderOpen size={48} strokeWidth={1.4} />,
    title: 'Проектов пока нет',
    hint: 'Проекты — это объекты с 8-этапным циклом проектирования: договор → изыскания → ИД → ПСД → согласование → ОВОС → экспертиза → сдача.',
  },
  'no-results': {
    icon: <Search size={48} strokeWidth={1.4} />,
    title: 'Ничего не найдено',
    hint: 'По заданным фильтрам и поисковому запросу нет проектов. Попробуйте изменить условия.',
  },
  'no-assigned': {
    icon: <UserCheck size={48} strokeWidth={1.4} />,
    title: 'Нет назначенных проектов',
    hint: 'Вам пока не назначены задачи или этапы в проектах. Как только это произойдёт, проекты появятся здесь.',
  },
}

export function ProjectsEmptyState({ kind, canCreate, onReset }: Props) {
  const copy = COPY[kind]

  return (
    <div className="card flex flex-col items-center justify-center text-center px-6 py-14 md:py-20 max-w-xl mx-auto">
      {/* Иконка с золотым подсветом */}
      <div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: 'color-mix(in oklab, var(--color-green) 8%, transparent)',
          border: '1px solid color-mix(in oklab, var(--color-green) 18%, transparent)',
        }}
      >
        <span
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-50"
          style={{
            background: 'radial-gradient(circle at 30% 20%, #E8C56730, transparent 70%)',
          }}
        />
        <span className="text-text-muted relative">{copy.icon}</span>
      </div>

      <h3 className="text-lg font-semibold text-text">{copy.title}</h3>
      <p className="text-sm mt-2 text-text-muted max-w-md leading-relaxed">{copy.hint}</p>

      {/* CTA */}
      <div className="mt-6 flex items-center gap-3 flex-wrap justify-center">
        {kind === 'no-projects' && canCreate && (
          <Link href="/dashboard/projects/new" className="btn-green">
            + Создать первый проект
          </Link>
        )}
        {kind === 'no-results' && onReset && (
          <button type="button" onClick={onReset} className="btn-green">
            Сбросить фильтры
          </button>
        )}
      </div>
    </div>
  )
}
