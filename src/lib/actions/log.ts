'use server'

import { createClient } from '@/lib/supabase/server'

// Вспомогательная функция записи в activity_log (для использования внутри Server Actions,
// когда supabase-клиент уже создан).
// Ошибки игнорируются — лог не должен ломать основную операцию.
export async function writeLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  actor_id: string,
  entity_type: 'task' | 'project' | 'stage' | 'event',
  entity_id: string,
  action: string,
  meta?: Record<string, unknown>,
) {
  try {
    await supabase.from('activity_log').insert({
      actor_id,
      entity_type,
      entity_id,
      action,
      meta: meta ?? null,
    })
  } catch {
    // тихо игнорируем
  }
}

// Standalone Server Action — можно вызывать из Client Components.
// Создаёт собственный supabase-клиент и пишет лог от имени текущего пользователя.
export async function logActivity(
  entity_type: 'task' | 'project' | 'stage' | 'event',
  entity_id: string,
  action: string,
  meta?: Record<string, unknown>,
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('activity_log').insert({
      actor_id: user.id,
      entity_type,
      entity_id,
      action,
      meta: meta ?? null,
    })
  } catch {
    // тихо игнорируем
  }
}
