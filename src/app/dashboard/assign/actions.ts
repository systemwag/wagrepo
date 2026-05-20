'use server'

import { requireDirector, requireAdmin } from '@/lib/auth'
import type { AssignedTask } from '@/components/assign/AssignTaskList'
import { queryAssignTasks, queryAllAssignTasks } from './queries'

/** Догрузка следующей страницы поручений директора — RPC из клиента. */
export async function fetchAssignTasksPage(page: number): Promise<AssignedTask[]> {
  const auth = await requireDirector()
  if (!auth.ok) return []
  return queryAssignTasks(auth.supabase, auth.userId, page)
}

/** Догрузка следующей страницы ВСЕХ поручений системы — только admin. */
export async function fetchAllAssignTasksPage(page: number): Promise<AssignedTask[]> {
  const auth = await requireAdmin()
  if (!auth.ok) return []
  return queryAllAssignTasks(auth.supabase, page)
}
