'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

// ─── Обновление личной информации ───────────────────────────────────────
// Whitelist полей — сотруднику разрешено менять только эти. Иначе клиент мог бы
// подсунуть role/is_active/wip_limit через `update profiles` (RLS «свой профиль»
// разрешает UPDATE всей строки).

const PHONE_RE = /^\+?[0-9\s\-()]{6,20}$/

export type UpdateProfileInput = {
  phone:      string | null
  birth_date: string | null  // 'YYYY-MM-DD' или null
}

export async function updateMyProfile(input: UpdateProfileInput): Promise<{ error: string | null }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  // Валидация
  const phone = input.phone?.trim() || null
  if (phone && !PHONE_RE.test(phone)) {
    return { error: 'Телефон должен содержать 6–20 цифр (можно с +, пробелами, скобками и дефисом).' }
  }

  const birth_date = input.birth_date?.trim() || null
  if (birth_date) {
    const d = new Date(birth_date)
    if (Number.isNaN(d.getTime())) return { error: 'Некорректная дата рождения.' }
    if (d.getTime() > Date.now())  return { error: 'Дата рождения в будущем.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ phone, birth_date })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/profile')
  return { error: null }
}

// ─── Смена пароля ────────────────────────────────────────────────────────
// Шаги:
//   1) reauth: signInWithPassword(email, currentPassword) — убеждаемся, что
//      пользователь действительно знает текущий пароль.
//   2) updateUser({ password: newPassword }) — собственно меняем.
// При фейле reauth (например, неверный текущий) возвращаем ошибку без апдейта.

export async function changeMyPassword(
  currentPassword: string,
  newPassword:     string,
): Promise<{ error: string | null }> {
  if (!currentPassword) return { error: 'Введите текущий пароль.' }
  if (!newPassword || newPassword.length < 8) {
    return { error: 'Новый пароль должен быть не короче 8 символов.' }
  }
  if (currentPassword === newPassword) {
    return { error: 'Новый пароль совпадает с текущим.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Не авторизован.' }

  // 1) Подтверждение текущего пароля
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email:    user.email,
    password: currentPassword,
  })
  if (reauthError) return { error: 'Неверный текущий пароль.' }

  // 2) Смена пароля
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) return { error: updateError.message }

  // Лог (тихо игнорим ошибки — лог не должен мешать смене пароля)
  try {
    await supabase.from('activity_log').insert({
      actor_id:    user.id,
      entity_type: 'profile',
      entity_id:   user.id,
      action:      'profile.password_changed',
      meta:        null,
    })
  } catch { /* ignore */ }

  return { error: null }
}
