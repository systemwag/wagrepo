/**
 * Иерархия ролей: admin > director > manager > employee.
 * Эти хелперы используются в Server/Client Components для проверки доступа
 * (только UI-слой; RLS в БД — независимый страж данных).
 */

export type UserRole = 'admin' | 'director' | 'manager' | 'employee'

/** Director-level access: admin или director. */
export function hasDirectorAccess(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'director'
}

/** Manager-level access: admin, director или manager. */
export function hasManagerAccess(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'director' || role === 'manager'
}

/** Только admin — для служебных/тестовых функций. */
export function isAdmin(role: string | null | undefined): boolean {
  return role === 'admin'
}
