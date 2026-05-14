import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type WipStatus = {
  active: number
  limit: number
  /** Кратко: ok / warning (близко к лимиту) / over (превышен). */
  state: 'ok' | 'warning' | 'over'
}

/**
 * Текущая загрузка сотрудника в задачах (in_progress).
 * Считает Postgres-функция get_user_active_wip — суммирует direct + project.
 */
export async function getUserWip(supabase: SupabaseClient, userId: string): Promise<WipStatus> {
  const [{ data: active }, { data: limit }] = await Promise.all([
    supabase.rpc('get_user_active_wip', { p_user_id: userId }),
    supabase.rpc('get_user_wip_limit',  { p_user_id: userId }),
  ])
  const a = (active as number | null) ?? 0
  const l = (limit as number | null) ?? 5
  let state: WipStatus['state'] = 'ok'
  if (a > l)        state = 'over'
  else if (a >= l - 1 && l > 0) state = 'warning'
  return { active: a, limit: l, state }
}

/**
 * Bulk-вариант: WIP для нескольких пользователей в одном вызове.
 * Использует один SQL-запрос к Postgres вместо N round-trips.
 */
export async function getUsersWip(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, WipStatus>> {
  const result = new Map<string, WipStatus>()
  if (userIds.length === 0) return result

  const [directRes, projectRes, profilesRes] = await Promise.all([
    supabase.from('direct_tasks')
      .select('assignee_id')
      .in('assignee_id', userIds)
      .eq('status', 'in_progress'),
    supabase.from('project_tasks')
      .select('assignee_id')
      .in('assignee_id', userIds)
      .eq('status', 'in_progress'),
    supabase.from('profiles')
      .select('id, wip_limit')
      .in('id', userIds),
  ])

  const counts = new Map<string, number>()
  for (const r of (directRes.data  ?? []) as { assignee_id: string }[]) counts.set(r.assignee_id, (counts.get(r.assignee_id) ?? 0) + 1)
  for (const r of (projectRes.data ?? []) as { assignee_id: string }[]) counts.set(r.assignee_id, (counts.get(r.assignee_id) ?? 0) + 1)

  const limits = new Map<string, number>()
  for (const p of (profilesRes.data ?? []) as { id: string; wip_limit: number | null }[]) {
    limits.set(p.id, p.wip_limit ?? 5)
  }

  for (const id of userIds) {
    const a = counts.get(id) ?? 0
    const l = limits.get(id) ?? 5
    let state: WipStatus['state'] = 'ok'
    if (a > l)        state = 'over'
    else if (a >= l - 1 && l > 0) state = 'warning'
    result.set(id, { active: a, limit: l, state })
  }
  return result
}
