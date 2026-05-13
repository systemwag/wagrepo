'use server'

import { requireAuth } from '@/lib/auth'
import type { Assignment } from '@/components/tasks/MyAssignmentsList'
import { ASSIGNMENTS_PAGE_SIZE } from './constants'

const SELECT = `
  id, title, description, employee_note, status, priority, deadline,
  creator:profiles!tasks_created_by_fkey(full_name)
`

/** Догрузка моих поручений (где я assignee, без проекта). */
export async function fetchMyAssignmentsPage(page: number): Promise<Assignment[]> {
  const auth = await requireAuth()
  if (!auth.ok) return []

  const from = page * ASSIGNMENTS_PAGE_SIZE
  const to   = from + ASSIGNMENTS_PAGE_SIZE - 1

  const { data } = await auth.supabase
    .from('tasks')
    .select(SELECT)
    .eq('assignee_id', auth.userId)
    .is('project_id', null)
    .order('deadline', { ascending: true, nullsFirst: false })
    .range(from, to)

  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>
    const c = r.creator
    const creator = Array.isArray(c) ? (c[0] as Assignment['creator']) ?? null : (c as Assignment['creator'])
    return { ...r, creator } as Assignment
  })
}
