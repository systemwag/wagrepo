'use server'

import { requireAuth } from '@/lib/auth'

export type ProjectActivityEntry = {
  id:          string
  actor_id:    string | null
  actor_name:  string | null
  entity_type: string
  entity_id:   string
  action:      string
  meta:        Record<string, unknown> | null
  created_at:  string
}

/**
 * Подгрузка следующего блока журнала прогресса проекта.
 * Использует RPC get_project_activity (см. миграцию 052), RLS проверяется
 * политикой activity_log_select — доступ к событиям project/stage/project_task
 * открыт всем authenticated.
 */
export async function loadMoreProjectActivity(
  projectId: string,
  offset: number,
  limit = 50,
): Promise<{ entries: ProjectActivityEntry[]; error: string | null }> {
  const auth = await requireAuth()
  if (!auth.ok) return { entries: [], error: auth.error }

  const { data, error } = await auth.supabase.rpc('get_project_activity', {
    p_project_id: projectId,
    p_limit:      limit,
    p_offset:     offset,
  })

  if (error) return { entries: [], error: error.message }
  return { entries: (data ?? []) as ProjectActivityEntry[], error: null }
}
