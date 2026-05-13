import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'director' | 'manager' | 'employee'

type AuthOk   = { ok: true;  error: null;   supabase: SupabaseClient; userId: string; role: UserRole }
type AuthFail = { ok: false; error: string; supabase: null;           userId: null;   role: null }
export type AuthResult = AuthOk | AuthFail

/**
 * Гарантирует, что вызывающий — авторизован, и (опционально) имеет одну из ролей.
 * Возвращает supabase-клиент, userId и роль, либо строку ошибки.
 *
 * Использование (TS-narrowing работает на дискриминанте `ok`):
 *   const auth = await requireAuth()
 *   if (!auth.ok) return { error: auth.error }
 *   const { supabase, userId } = auth     // тут уже всё non-null
 *
 * С ограничением по роли:
 *   const auth = await requireAuth(['director', 'manager'])
 *   if (!auth.ok) return { error: auth.error }
 */
export async function requireAuth(allowedRoles?: UserRole[]): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'Не авторизован', supabase: null, userId: null, role: null }
  }

  // Если роль не нужна — пропускаем второй запрос. Минус 1 RTT к БД.
  if (!allowedRoles || allowedRoles.length === 0) {
    return { ok: true, error: null, supabase, userId: user.id, role: 'employee' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as UserRole | undefined
  if (!role || !allowedRoles.includes(role)) {
    return { ok: false, error: 'Нет прав', supabase: null, userId: null, role: null }
  }

  return { ok: true, error: null, supabase, userId: user.id, role }
}

/** Шорткаты для частых случаев. */
export const requireDirector = () => requireAuth(['director'])
export const requireManager  = () => requireAuth(['director', 'manager'])
