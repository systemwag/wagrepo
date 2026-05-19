import { FolderOpen, Archive } from 'lucide-react'
import Link from 'next/link'
import { getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import NewProjectButton from './NewProjectButton'
import ProjectListClient from './ProjectListClient'
import { fetchProjectsPageWithCount, fetchMyProjectsPage } from './actions'
import { hasManagerAccess } from '@/lib/roles'

const PAGE_SIZE = 20

export default async function ProjectsPage() {
  const profile = await getProfile()

  const isManager   = profile?.role === 'manager'
  const isEmployee  = profile?.role === 'employee'
  const userId      = profile?.id ?? null

  const filterByManagerId = isManager && userId ? userId : null

  // Один запрос вместо трёх: для employee — RPC, для остальных — обычный select.
  const { rows: initial, count: total } = isEmployee && userId
    ? await fetchMyProjectsPage(userId, 0, PAGE_SIZE)
    : await fetchProjectsPageWithCount(0, PAGE_SIZE, filterByManagerId, false)

  const canCreate = hasManagerAccess(profile?.role)

  return (
    <div className="@container">
      <PageHeader
        icon={<FolderOpen size={18} />}
        iconTone="green"
        title={
          <span>
            Проекты
            <span className="num text-text-muted ml-2 text-base font-normal">· {total}</span>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/projects/archive"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text-muted hover-text hover-surface transition-colors"
              title="Архив завершённых проектов"
              aria-label="Архив"
            >
              <Archive size={16} />
              <span className="hidden sm:inline">Архив</span>
            </Link>
            {canCreate && <NewProjectButton />}
          </div>
        }
      />
      <ProjectListClient
        initial={initial}
        total={total}
        filterByManagerId={filterByManagerId}
        /* employee использует RPC при load-more; для остальных — обычный фильтр */
        employeeUserId={isEmployee && userId ? userId : null}
        canCreate={canCreate}
        viewerRole={(profile?.role ?? 'employee') as 'admin' | 'director' | 'manager' | 'employee'}
      />
    </div>
  )
}
