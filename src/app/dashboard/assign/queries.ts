import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssignedTask } from '@/components/assign/AssignTaskList'
import { ASSIGN_PAGE_SIZE } from './constants'

const SELECT = `
  id, title, description, priority, status, deadline, employee_note, created_at,
  assignee:profiles!direct_tasks_assignee_id_fkey(id, full_name, position)
`

/**
 * Запрос прямых поручений директора (direct_tasks). Используется напрямую
 * из server components, чтобы не делать повторный auth-check через
 * `requireDirector()` (это лишний RTT к Supabase Auth).
 *
 * НЕ в `'use server'` — это серверный helper, а не RPC для клиента.
 */
export async function queryAssignTasks(
  supabase: SupabaseClient, userId: string, page: number,
): Promise<AssignedTask[]> {
  const from = page * ASSIGN_PAGE_SIZE
  const to   = from + ASSIGN_PAGE_SIZE - 1

  const { data } = await supabase
    .from('direct_tasks')
    .select(SELECT)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>
    const a = r.assignee
    const assignee = Array.isArray(a) ? (a[0] as AssignedTask['assignee']) ?? null : (a as AssignedTask['assignee'])
    return { ...r, assignee } as AssignedTask
  })
}
