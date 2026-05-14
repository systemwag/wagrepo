'use server'

import { revalidatePath } from 'next/cache'
import { requireDirector } from '@/lib/auth'

/**
 * Изменить WIP-лимит сотрудника. Допустимо только директору (или admin
 * через has_director_access). Минимум 1, максимум 50 — за пределами этого
 * либо саботаж, либо опечатка.
 */
export async function updateWipLimit(userId: string, newLimit: number) {
  if (!Number.isInteger(newLimit) || newLimit < 1 || newLimit > 50) {
    return { error: 'Лимит должен быть целым числом от 1 до 50' }
  }
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId: actorId } = auth

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, wip_limit')
    .eq('id', userId)
    .single()

  const oldLimit = (profile?.wip_limit as number | null) ?? 5

  const { error } = await supabase
    .from('profiles')
    .update({ wip_limit: newLimit })
    .eq('id', userId)
  if (error) return { error: error.message }

  // Лог: пишем напрямую, т.к. writeLog ограничен entity_type'ами доменными.
  // entity_type='profile' — это меняли профиль сотрудника.
  try {
    await supabase.from('activity_log').insert({
      actor_id: actorId,
      entity_type: 'profile',
      entity_id: userId,
      action: 'wip_limit.changed',
      meta: {
        target_user: profile?.full_name ?? null,
        from: oldLimit,
        to: newLimit,
      },
    })
  } catch {
    // лог не должен ломать основную операцию
  }

  revalidatePath('/dashboard/workload')
  return { error: null }
}
