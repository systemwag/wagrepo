import { createClient, getUser, getProfile } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'director' | 'manager' | 'employee'

type AuthOk   = { ok: true;  error: null;   supabase: SupabaseClient; userId: string; role: UserRole }
type AuthFail = { ok: false; error: string; supabase: null;           userId: null;   role: null }
export type AuthResult = AuthOk | AuthFail

/**
 * Гарантирует, что вызывающий — авторизован, и (опционально) имеет одну из ролей.
 * Возвращает supabase-клиент, userId и роль, либо строку ошибки.
 *
 * Использует кешированные `getUser` / `getProfile` (React `cache()` дедуплицирует
 * вызовы в рамках одного запроса — не делаем повторных RTT к Supabase Auth,
 * если страница уже вызвала `getProfile()`).
 */
export async function requireAuth(allowedRoles?: UserRole[]): Promise<AuthResult> {
  const [supabase, user] = await Promise.all([createClient(), getUser()])
  if (!user) {
    return { ok: false, error: 'Не авторизован', supabase: null, userId: null, role: null }
  }

  // Если роль не нужна — пропускаем загрузку профиля.
  if (!allowedRoles || allowedRoles.length === 0) {
    return { ok: true, error: null, supabase, userId: user.id, role: 'employee' }
  }

  const profile = await getProfile()
  const role = profile?.role as UserRole | undefined
  if (!role || !allowedRoles.includes(role)) {
    return { ok: false, error: 'Нет прав', supabase: null, userId: null, role: null }
  }

  return { ok: true, error: null, supabase, userId: user.id, role }
}

/** Шорткаты для частых случаев. */
export const requireDirector = () => requireAuth(['director'])
export const requireManager  = () => requireAuth(['director', 'manager'])
