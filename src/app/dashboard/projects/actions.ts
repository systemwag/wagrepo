'use server'

import { requireAuth } from '@/lib/auth'
import type { PipelineStage } from '@/components/projects/StagePipeline'

export type ProjectListItem = {
  id: string
  name: string
  status: string
  deadline: string | null
  start_date: string | null
  client_name: string | null
  contract_number: string | null
  budget: number | null
  created_at: string
  manager: { full_name: string } | null
  stages: PipelineStage[]
}

// ─── RPC для employee: проекты, где пользователь — assignee задачи/этапа ────
/** Возвращает страницу проектов сотрудника + total одним запросом. */
export async function fetchMyProjectsPage(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ rows: ProjectListItem[]; count: number }> {
  const auth = await requireAuth()
  if (!auth.ok) return { rows: [], count: 0 }

  const { data, error } = await auth.supabase.rpc('get_my_projects_page', {
    p_user_id: userId,
    p_page:    page,
    p_size:    pageSize,
  })
  if (error) {
    console.error('[fetchMyProjectsPage] ERROR:', error.message, error.code)
    return { rows: [], count: 0 }
  }

  type Row = {
    id: string; name: string; status: string;
    deadline: string | null; start_date: string | null;
    client_name: string | null; contract_number: string | null;
    budget: number | null; created_at: string;
    manager_name: string | null;
    stages: PipelineStage[] | null;
    total_count: number;
  }

  const rows = ((data ?? []) as Row[]).map((r): ProjectListItem => ({
    id:              r.id,
    name:            r.name,
    status:          r.status,
    deadline:        r.deadline,
    start_date:      r.start_date,
    client_name:     r.client_name,
    contract_number: r.contract_number,
    budget:          r.budget,
    created_at:      r.created_at,
    manager:         r.manager_name ? { full_name: r.manager_name } : null,
    stages:          r.stages ?? [],
  }))

  const count = (data && data.length > 0) ? Number((data[0] as Row).total_count) : 0
  return { rows, count }
}

const SELECT = `
  id, name, status, deadline, start_date, client_name, contract_number, budget, created_at,
  manager:profiles!projects_manager_id_fkey(full_name),
  stages:project_stages!project_stages_project_id_fkey(stage_key, status, deadline, review_status)
`

/**
 * Догружает следующую страницу проектов.
 * page — индекс страницы начиная с 1 (страница 0 рендерится на сервере SSR-ом).
 * filterByManagerId — для роли manager: только свои проекты.
 * filterByProjectIds — для роли employee: только проекты, в которых сотрудник
 *   назначен на этап или задачу. null — без ограничения по id; [] — пусто.
 * archived — true для /projects/archive (только completed/cancelled),
 *            false/undefined для основного списка (всё кроме них).
 */
export async function fetchProjectsPage(
  page: number,
  pageSize: number,
  filterByManagerId: string | null,
  archived = false,
  filterByProjectIds: string[] | null = null,
): Promise<ProjectListItem[]> {
  const r = await fetchProjectsPageWithCount(page, pageSize, filterByManagerId, archived, filterByProjectIds)
  return r.rows
}

/** То же, что fetchProjectsPage, но возвращает ещё и total — для первой страницы.
 *  Один RTT вместо отдельных count + select. */
export async function fetchProjectsPageWithCount(
  page: number,
  pageSize: number,
  filterByManagerId: string | null,
  archived = false,
  filterByProjectIds: string[] | null = null,
): Promise<{ rows: ProjectListItem[]; count: number }> {
  const auth = await requireAuth()
  if (!auth.ok) return { rows: [], count: 0 }

  if (filterByProjectIds !== null && filterByProjectIds.length === 0) {
    return { rows: [], count: 0 }
  }

  const from = page * pageSize
  const to   = from + pageSize - 1

  let query = auth.supabase
    .from('projects')
    .select(SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filterByManagerId)           query = query.eq('manager_id', filterByManagerId)
  if (filterByProjectIds !== null) query = query.in('id', filterByProjectIds)
  query = archived
    ? query.in('status', ['completed', 'cancelled'])
    : query.not('status', 'in', '(completed,cancelled)')

  const { data, count, error } = await query
  if (error) {
    console.error('[fetchProjectsPage] ERROR:', error.message, error.code)
  }
  return { rows: normalize(data ?? []), count: count ?? 0 }
}

/** Supabase возвращает FK как массив (хотя single FK) — нормализуем в объект.
 *  Этапы оставляем массивом, но кастуем к PipelineStage. */
function normalize(rows: unknown[]): ProjectListItem[] {
  return rows.map(row => {
    const r = row as Record<string, unknown>
    const m = r.manager
    const manager = Array.isArray(m)
      ? (m[0] as { full_name: string } | undefined) ?? null
      : (m as { full_name: string } | null)
    const stages = Array.isArray(r.stages) ? (r.stages as PipelineStage[]) : []
    return { ...r, manager, stages } as ProjectListItem
  })
}
