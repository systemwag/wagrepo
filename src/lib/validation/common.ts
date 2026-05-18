import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Общие билдинг-блоки для zod-схем Server Actions.
// Сообщения об ошибках — на русском (UI-язык).
// Перечисления подобраны под реальные ENUM в БД (см. supabase/schema.sql и
// миграции 002, 007, 009, 026, 028).
// ─────────────────────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid('Некорректный идентификатор')

export const optionalUuidSchema = z
  .string()
  .uuid('Некорректный идентификатор')
  .nullable()
  .optional()

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')

export const timeOnlySchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Время должно быть в формате HH:MM')

export const nullableDateSchema = dateOnlySchema.nullable().optional()

export function nonEmptyTextSchema(maxLen: number, label = 'Поле') {
  return z
    .string()
    .trim()
    .min(1, `${label} обязательно`)
    .max(maxLen, `${label} не должно превышать ${maxLen} символов`)
}

export function optionalTextSchema(maxLen: number) {
  return z
    .string()
    .max(maxLen, `Текст не должен превышать ${maxLen} символов`)
    .optional()
}

export const phoneSchema = z
  .string()
  .regex(/^\+?7\d{10}$/, 'Телефон должен быть в формате +7XXXXXXXXXX')
  .or(z.literal(''))
  .optional()

export const emailSchema = z.string().email('Некорректный email')

// ── Перечисления (соответствуют ENUM-типам в БД) ─────────────────────────

// task_priority — schema.sql: ('low', 'medium', 'high', 'critical')
export const priorityEnum = z.enum(['low', 'medium', 'high', 'critical'])

// task_status — schema.sql + миграция 049: ('todo', 'in_progress', 'review', 'done', 'failed')
export const taskStatusEnum = z.enum(['todo', 'in_progress', 'review', 'done', 'failed'])

// event_importance — миграция 009: ('low', 'medium', 'high', 'critical')
export const eventImportanceEnum = z.enum(['low', 'medium', 'high', 'critical'])

// user_role — schema.sql + миграция 028: ('director', 'manager', 'employee', 'admin')
export const userRoleEnum = z.enum(['director', 'manager', 'employee', 'admin'])
