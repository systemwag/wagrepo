import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssignedTask } from '@/components/assign/AssignTaskList'
import { ASSIGN_PAGE_SIZE } from './constants'

const SELECT = `
  id, title, description, priority, status, deadline, employee_note, created_at, accepted_at, completed_at, batch_id,
  assignee:profiles!direct_tasks_assignee_id_fkey(id, full_name, position),
  creator:profiles!direct_tasks_created_by_fkey(id, full_name)
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

  return normalizeRows(data ?? [])
}

/**
 * Запрос ВСЕХ поручений в системе — без фильтра по created_by. Используется
 * на странице /dashboard/assign/all (только admin).
 */
export async function queryAllAssignTasks(
  supabase: SupabaseClient, page: number,
): Promise<AssignedTask[]> {
  const from = page * ASSIGN_PAGE_SIZE
  const to   = from + ASSIGN_PAGE_SIZE - 1

  const { data } = await supabase
    .from('direct_tasks')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .range(from, to)

  return normalizeRows(data ?? [])
}

function normalizeRows(data: unknown[]): AssignedTask[] {
  return data.map(row => {
    const r = row as Record<string, unknown>
    const a = r.assignee
    const c = r.creator
    const assignee = Array.isArray(a) ? (a[0] as AssignedTask['assignee']) ?? null : (a as AssignedTask['assignee'])
    const creator  = Array.isArray(c) ? (c[0] as AssignedTask['creator'])  ?? null : (c as AssignedTask['creator'])
    return { ...r, assignee, creator } as AssignedTask
  })
}
