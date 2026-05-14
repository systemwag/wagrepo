'use server'

import { requireAuth } from '@/lib/auth'
import type { Assignment } from '@/components/tasks/MyAssignmentsList'
import { queryMyAssignments } from './queries'

/** Догрузка моих поручений (direct_tasks, где я assignee). Client-side RPC. */
export async function fetchMyAssignmentsPage(page: number): Promise<Assignment[]> {
  const auth = await requireAuth()
  if (!auth.ok) return []
  return queryMyAssignments(auth.supabase, auth.userId, page)
}
