'use server'

import { requireAuth } from '@/lib/auth'
import { queryMyPollsPage, type PollSummary } from './queries'
import type { PollStatusFilter } from './constants'
import { POLLS_PAGE_SIZE } from './constants'

/**
 * Подгрузка страницы «Мои опубликованные» с фильтром по статусу.
 * Возвращает пустой массив, если не авторизован.
 */
export async function fetchMyPollsPage(
  page: number,
  status: PollStatusFilter = 'all',
): Promise<PollSummary[]> {
  const auth = await requireAuth()
  if (!auth.ok) return []
  return queryMyPollsPage(auth.supabase, auth.userId, page, POLLS_PAGE_SIZE, status)
}
