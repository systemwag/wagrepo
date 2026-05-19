'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

// Service-role клиент для смены email без email-подтверждения.
// Безопасность: userId всегда берётся из auth.getUser(), а не из form-input.
function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ─── Обновление личной информации ───────────────────────────────────────
// Whitelist полей: всё что сотруднику разрешено менять самостоятельно.
// role и is_active НЕ в списке — их меняет директор через /employees,
// RLS profiles_update (миграция 043) тоже запрещает их менять самому.

const PHONE_RE = /^\+?[0-9\s\-()]{6,20}$/

export type UpdateProfileInput = {
  full_name:  string
  position:   string | null
  department: string | null
  phone:      string | null
  birth_date: string | null  // 'YYYY-MM-DD' или null
}

export async function updateMyProfile(input: UpdateProfileInput): Promise<{ error: string | null }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  // Валидация
  const full_name = input.full_name?.trim() ?? ''
  if (full_name.length < 2)   return { error: 'ФИО должно быть не короче 2 символов.' }
  if (full_name.length > 200) return { error: 'ФИО слишком длинное (максимум 200 символов).' }

  const position = input.position?.trim() || null
  if (position && position.length > 100) {
    return { error: 'Должность слишком длинная (максимум 100 символов).' }
  }

  const department = input.department?.trim() || null
  if (department && department.length > 100) {
    return { error: 'Название отдела слишком длинное (максимум 100 символов).' }
  }

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
    .update({ full_name, position, department, phone, birth_date })
    .eq('id', userId)

  if (error) return { error: error.message }

  // Имя/должность видны в Sidebar и других местах — обновляем весь dashboard layout.
  revalidatePath('/dashboard', 'layout')
  return { error: null }
}

// ─── Смена email ─────────────────────────────────────────────────────────
// Email хранится в auth.users (не в profiles). Используем admin-клиент с
// service_role, чтобы менять напрямую без email-подтверждения (`email_confirm:
// true`). userId берётся ТОЛЬКО из auth.getUser() — пользователь меняет
// исключительно свой email.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function changeMyEmail(newEmail: string): Promise<{ error: string | null }> {
  const trimmed = newEmail.trim().toLowerCase()
  if (!trimmed)                return { error: 'Введите email.' }
  if (!EMAIL_RE.test(trimmed)) return { error: 'Некорректный email.' }
  if (trimmed.length > 254)    return { error: 'Email слишком длинный.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован.' }

  if (user.email?.toLowerCase() === trimmed) {
    return { error: 'Этот email уже используется.' }
  }

  const admin = adminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email: trimmed,
    email_confirm: true, // помечаем email как уже подтверждённый
  })
  if (error) {
    if (error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('registered')) {
      return { error: 'Этот email уже занят другим аккаунтом.' }
    }
    return { error: error.message }
  }

  try {
    await supabase.from('activity_log').insert({
      actor_id:    user.id,
      entity_type: 'profile',
      entity_id:   user.id,
      action:      'profile.email_changed',
      meta:        { old_email: user.email, new_email: trimmed },
    })
  } catch { /* ignore */ }

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
