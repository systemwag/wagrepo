import { z } from 'zod'
import {
  emailSchema,
  nonEmptyTextSchema,
  phoneSchema,
  uuidSchema,
  userRoleEnum,
} from './common'

// ─────────────────────────────────────────────────────────────────────────────
// Сотрудники. Используется в src/app/dashboard/employees/actions.ts.
// Этот модуль использует service_role — особенно важна валидация на входе.
// ─────────────────────────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  email:      emailSchema,
  password:   z.string().min(6, 'Пароль должен быть не менее 6 символов').max(72, 'Пароль слишком длинный'),
  full_name:  nonEmptyTextSchema(120, 'ФИО'),
  role:       userRoleEnum,
  position:   z.string().max(120, 'Должность не должна превышать 120 символов').optional().default(''),
  department: z.string().max(120, 'Отдел не должен превышать 120 символов').optional().default(''),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
    .or(z.literal(''))
    .optional()
    .default(''),
  phone:      phoneSchema,
})

export const updateEmployeeSchema = z.object({
  email:      emailSchema.optional().or(z.literal('')),
  full_name:  nonEmptyTextSchema(120, 'ФИО'),
  role:       userRoleEnum,
  position:   z.string().max(120, 'Должность не должна превышать 120 символов').optional().default(''),
  department: z.string().max(120, 'Отдел не должен превышать 120 символов').optional().default(''),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
    .or(z.literal(''))
    .optional()
    .default(''),
  phone: z
    .string()
    .regex(/^\+?7\d{10}$/, 'Телефон должен быть в формате +7XXXXXXXXXX')
    .or(z.literal(''))
    .optional()
    .default(''),
  is_active: z.boolean(),
})

export const employeeIdSchema = uuidSchema

export const resetPasswordSchema = z.object({
  id:       uuidSchema,
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов').max(72, 'Пароль слишком длинный'),
})

export const departmentNameSchema = z
  .string()
  .trim()
  .min(1, 'Название отдела не может быть пустым')
  .max(120, 'Название отдела не должно превышать 120 символов')

export const renameDepartmentSchema = z.object({
  oldName: z.string().min(1, 'Старое название отдела обязательно').max(120),
  newName: departmentNameSchema,
})
