import { z } from 'zod'
import {
  nonEmptyTextSchema,
  nullableDateSchema,
  uuidSchema,
} from './common'

// ─────────────────────────────────────────────────────────────────────────────
// Проекты. См. src/lib/actions/projects.ts.
// Поля совпадают с формой /dashboard/projects/new минус template_id —
// шаблон после создания не редактируется (этапы уже привязаны к нему).
// ─────────────────────────────────────────────────────────────────────────────

export const projectUpdateSchema = z
  .object({
    id:              uuidSchema,
    name:            nonEmptyTextSchema(200, 'Название проекта'),
    client_name:     z.string().trim().max(200, 'Слишком длинное название заказчика').optional(),
    contract_number: z.string().trim().max(100, 'Слишком длинный номер договора').optional(),
    start_date:      nullableDateSchema,
    deadline:        nullableDateSchema,
    description:     z.string().max(5000, 'Описание слишком длинное').optional(),
    manager_id:      uuidSchema,
  })
  .refine(
    v => !v.start_date || !v.deadline || v.deadline >= v.start_date,
    { message: 'Дедлайн должен быть не раньше даты начала', path: ['deadline'] },
  )

export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>
