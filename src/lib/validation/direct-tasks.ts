import { z } from 'zod'
import {
  dateOnlySchema,
  nonEmptyTextSchema,
  priorityEnum,
  taskStatusEnum,
  uuidSchema,
} from './common'

// ─────────────────────────────────────────────────────────────────────────────
// Прямые поручения (direct_tasks). Создаёт только директор.
// См. src/lib/actions/direct-tasks.ts.
// ─────────────────────────────────────────────────────────────────────────────

const deadlineField = dateOnlySchema.nullable().optional()

export const createDirectTaskSchema = z.object({
  title:       nonEmptyTextSchema(200, 'Название поручения'),
  description: z.string().max(5000, 'Описание не должно превышать 5000 символов').optional().default(''),
  assignee_id: uuidSchema,
  priority:    priorityEnum,
  deadline:    deadlineField,
})

export const createDirectTaskBulkSchema = z.object({
  title:        nonEmptyTextSchema(200, 'Название поручения'),
  description:  z.string().max(5000, 'Описание не должно превышать 5000 символов').optional().default(''),
  assignee_ids: z.array(uuidSchema).min(1, 'Выберите хотя бы одного исполнителя').max(100, 'Слишком много исполнителей за раз'),
  priority:     priorityEnum,
  deadline:     deadlineField,
})

export const updateDirectTaskSchema = z.object({
  title:       nonEmptyTextSchema(200, 'Название поручения'),
  description: z.string().max(5000, 'Описание не должно превышать 5000 символов').optional().default(''),
  assignee_id: uuidSchema,
  priority:    priorityEnum,
  deadline:    deadlineField,
})

export const updateDirectTaskStatusSchema = z.object({
  taskId: uuidSchema,
  status: taskStatusEnum,
})

export const submitDirectTaskFeedbackSchema = z.object({
  taskId: uuidSchema,
  note:   z.string().max(5000, 'Комментарий не должен превышать 5000 символов').optional().default(''),
  status: taskStatusEnum,
})

export const deleteDirectTaskSchema = uuidSchema
