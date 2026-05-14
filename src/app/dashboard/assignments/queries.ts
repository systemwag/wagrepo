import type { SupabaseClient } from '@supabase/supabase-js'
import type { Assignment } from '@/components/tasks/MyAssignmentsList'
import { ASSIGNMENTS_PAGE_SIZE } from './constants'

const SELECT = `
  id, title, description, employee_note, status, priority, deadline,
  creator:profiles!direct_tasks_created_by_fkey(full_name)
`

/**
 * Запрос моих поручений (direct_tasks, где я assignee).
 * Серверный helper, не RPC — page.tsx зовёт напрямую без повторной авторизации.
 */
export async function queryMyAssignments(
  supabase: SupabaseClient, userId: string, page: number,
): Promise<Assignment[]> {
  const from = page * ASSIGNMENTS_PAGE_SIZE
  const to   = from + ASSIGNMENTS_PAGE_SIZE - 1

  const { data } = await supabase
    .from('direct_tasks')
    .select(SELECT)
    .eq('assignee_id', userId)
    .order('deadline', { ascending: true, nullsFirst: false })
    .range(from, to)

  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>
    const c = r.creator
    const creator = Array.isArray(c) ? (c[0] as Assignment['creator']) ?? null : (c as Assignment['creator'])
    return { ...r, creator } as Assignment
  })
}
