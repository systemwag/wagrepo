import { z } from 'zod'
import {
  dateOnlySchema,
  nonEmptyTextSchema,
  priorityEnum,
  taskStatusEnum,
  uuidSchema,
} from './common'

// ─────────────────────────────────────────────────────────────────────────────
// Задачи в проектах (project_tasks). Привязаны к этапу.
// См. src/lib/actions/project-tasks.ts.
// ─────────────────────────────────────────────────────────────────────────────

const deadlineField = dateOnlySchema.nullable().optional()

export const createProjectTaskSchema = z.object({
  project_id:        uuidSchema,
  stage_id:          uuidSchema,
  checklist_item_id: uuidSchema.nullable().optional(),
  title:             nonEmptyTextSchema(200, 'Название задачи'),
  description:       z.string().max(5000, 'Описание не должно превышать 5000 символов').optional().default(''),
  assignee_id:       uuidSchema.nullable().optional(),
  priority:          priorityEnum.optional(),
  deadline:          deadlineField,
})

export const moveProjectTaskSchema = z.object({
  taskId:     uuidSchema,
  newStageId: uuidSchema,
  projectId:  uuidSchema,
})

export const reorderProjectTasksSchema = z.object({
  stageId:    uuidSchema,
  orderedIds: z.array(uuidSchema).min(1, 'Список задач пустой').max(500, 'Слишком много задач за раз'),
  projectId:  uuidSchema,
})

export const updateProjectTaskStatusSchema = z.object({
  taskId:    uuidSchema,
  status:    taskStatusEnum,
  projectId: uuidSchema,
})

export const submitProjectTaskFeedbackSchema = z.object({
  taskId:    uuidSchema,
  note:      z.string().max(5000, 'Комментарий не должен превышать 5000 символов').optional().default(''),
  status:    taskStatusEnum,
  projectId: uuidSchema,
})

export const deleteProjectTaskSchema = z.object({
  taskId:    uuidSchema,
  projectId: uuidSchema,
})
