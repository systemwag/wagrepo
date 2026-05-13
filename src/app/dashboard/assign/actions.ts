'use server'

import { requireDirector } from '@/lib/auth'
import type { AssignedTask } from '@/components/assign/AssignTaskList'
import { ASSIGN_PAGE_SIZE } from './constants'

const SELECT = `
  id, title, description, priority, status, deadline, employee_note, created_at,
  assignee:profiles!tasks_assignee_id_fkey(id, full_name, position)
`

/** Догрузка следующей страницы поручений директора (project_id IS NULL). */
export async function fetchAssignTasksPage(page: number): Promise<AssignedTask[]> {
  const auth = await requireDirector()
  if (!auth.ok) return []

  const from = page * ASSIGN_PAGE_SIZE
  const to   = from + ASSIGN_PAGE_SIZE - 1

  const { data } = await auth.supabase
    .from('tasks')
    .select(SELECT)
    .is('project_id', null)
    .eq('created_by', auth.userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>
    const a = r.assignee
    const assignee = Array.isArray(a) ? (a[0] as AssignedTask['assignee']) ?? null : (a as AssignedTask['assignee'])
    return { ...r, assignee } as AssignedTask
  })
}
