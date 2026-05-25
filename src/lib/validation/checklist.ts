import { z } from 'zod'
import { uuidSchema, dateOnlySchema } from './common'

// ─────────────────────────────────────────────────────────────────────────────
// Валидация для server actions чек-листа (миграция 065).
// ─────────────────────────────────────────────────────────────────────────────

export const checklistItemAssigneesSchema = z.object({
  itemId:     uuidSchema,
  projectId:  uuidSchema,
  profileIds: z.array(uuidSchema).max(20, 'Слишком много ответственных'),
})

export const checklistItemDeadlineSchema = z.object({
  itemId:    uuidSchema,
  projectId: uuidSchema,
  deadline:  dateOnlySchema.nullable(),
})

export const checklistItemAcceptSchema = z.object({
  itemId:    uuidSchema,
  projectId: uuidSchema,
})

export type ChecklistItemAssigneesInput = z.infer<typeof checklistItemAssigneesSchema>
export type ChecklistItemDeadlineInput  = z.infer<typeof checklistItemDeadlineSchema>
export type ChecklistItemAcceptInput    = z.infer<typeof checklistItemAcceptSchema>
