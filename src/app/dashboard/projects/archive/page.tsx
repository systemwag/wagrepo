import { Archive, ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { TransitionLink } from '@/components/ui/TransitionLink'
import { getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { fetchProjectsPageWithCount } from '../actions'
import ArchivedProjectsClient from './ArchivedProjectsClient'

const PAGE_SIZE = 20

export default async function ProjectsArchivePage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const isManager = profile.role === 'manager'
  const filterByManagerId = isManager ? profile.id : null

  // Один запрос вместо двух: rows + count
  const { rows: initial, count: total } = await fetchProjectsPageWithCount(
    0, PAGE_SIZE, filterByManagerId, true,
  )

  return (
    <div className="@container">
      <PageHeader
        icon={<Archive size={18} />}
        iconTone="info"
        title={
          <span>
            Архив проектов
            <span className="num text-text-muted ml-2 text-base font-normal">· {total}</span>
          </span>
        }
        subtitle="Завершённые и отменённые проекты"
        action={
          <TransitionLink
            href="/dashboard/projects"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text-muted hover-text hover-surface transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">К активным</span>
          </TransitionLink>
        }
      />
      <ArchivedProjectsClient
        initial={initial}
        total={total}
        filterByManagerId={filterByManagerId}
      />
    </div>
  )
}
