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

const SELECT = `
  id, name, status, deadline, start_date, client_name, contract_number, budget, created_at,
  manager:profiles!projects_manager_id_fkey(full_name),
  stages:project_stages(stage_key, status, deadline, review_status)
`

/**
 * Догружает следующую страницу проектов.
 * page — индекс страницы начиная с 1 (страница 0 рендерится на сервере SSR-ом).
 * filterByManagerId — для роли manager: только свои проекты.
 */
export async function fetchProjectsPage(
  page: number,
  pageSize: number,
  filterByManagerId: string | null,
): Promise<ProjectListItem[]> {
  const auth = await requireAuth()
  if (!auth.ok) return []

  const from = page * pageSize
  const to   = from + pageSize - 1

  let query = auth.supabase
    .from('projects')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filterByManagerId) query = query.eq('manager_id', filterByManagerId)

  const { data } = await query
  return normalize(data ?? [])
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
