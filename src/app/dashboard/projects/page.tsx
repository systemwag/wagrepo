import { FolderOpen } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import NewProjectButton from './NewProjectButton'
import ProjectListClient from './ProjectListClient'
import { fetchProjectsPage } from './actions'

const PAGE_SIZE = 20

export default async function ProjectsPage() {
  const [supabase, profile] = await Promise.all([
    createClient(),
    getProfile(),
  ])

  const isDirector = profile?.role === 'director'
  const isManager  = profile?.role === 'manager'
  const userId     = profile?.id ?? null
  const filterByManagerId = isManager && userId ? userId : null

  let countQuery = supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })

  if (filterByManagerId) countQuery = countQuery.eq('manager_id', filterByManagerId)

  const [{ count: total }, initial] = await Promise.all([
    countQuery,
    fetchProjectsPage(0, PAGE_SIZE, filterByManagerId),
  ])

  const canCreate = isDirector || isManager

  return (
    <div className="@container">
      <PageHeader
        icon={<FolderOpen size={18} />}
        iconTone="green"
        title={
          <span>
            Проекты
            <span className="num text-text-muted ml-2 text-base font-normal">· {total ?? 0}</span>
          </span>
        }
        action={canCreate ? <NewProjectButton /> : undefined}
      />
      <ProjectListClient
        initial={initial}
        total={total ?? 0}
        filterByManagerId={filterByManagerId}
        canCreate={canCreate}
        viewerRole={(profile?.role ?? 'employee') as 'director' | 'manager' | 'employee'}
      />
    </div>
  )
}
