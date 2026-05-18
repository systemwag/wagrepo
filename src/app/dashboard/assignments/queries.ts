import type { SupabaseClient } from '@supabase/supabase-js'
import type { Assignment } from '@/components/tasks/MyAssignmentsList'
import { ASSIGNMENTS_PAGE_SIZE } from './constants'

// Фильтрация через junction direct_task_assignees!inner — этот путь покрывает
// и legacy assignee_id (синхронизируется триггером миграции 045), и добавленных
// через setDirectTaskAssignees(). Через прямой eq('assignee_id', userId) видны
// были бы только первые исполнители — это та самая дыра.
export const ASSIGNMENT_SELECT = `
  id, title, description, employee_note, status, priority, deadline,
  creator:profiles!direct_tasks_created_by_fkey(full_name),
  direct_task_assignees!inner(profile_id)
`

/**
 * Запрос моих поручений (direct_tasks, где я в junction-таблице).
 * Серверный helper, не RPC — page.tsx зовёт напрямую без повторной авторизации.
 */
export async function queryMyAssignments(
  supabase: SupabaseClient, userId: string, page: number,
): Promise<Assignment[]> {
  const from = page * ASSIGNMENTS_PAGE_SIZE
  const to   = from + ASSIGNMENTS_PAGE_SIZE - 1

  const { data } = await supabase
    .from('direct_tasks')
    .select(ASSIGNMENT_SELECT)
    .eq('direct_task_assignees.profile_id', userId)
    .order('deadline', { ascending: true, nullsFirst: false })
    .range(from, to)

  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>
    const c = r.creator
    const creator = Array.isArray(c) ? (c[0] as Assignment['creator']) ?? null : (c as Assignment['creator'])
    // direct_task_assignees нужен только для фильтра — не пробрасываем в UI
    const { direct_task_assignees: _ignored, ...rest } = r
    return { ...rest, creator } as Assignment
  })
}
