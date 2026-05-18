import { z } from 'zod'
import {
  dateOnlySchema,
  eventImportanceEnum,
  nonEmptyTextSchema,
  timeOnlySchema,
  uuidSchema,
} from './common'

// ─────────────────────────────────────────────────────────────────────────────
// События / мероприятия. См. src/lib/actions/events.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const eventInputSchema = z.object({
  title:           nonEmptyTextSchema(200, 'Название события'),
  description:     z.string().max(5000, 'Описание слишком длинное').optional(),
  date:            dateOnlySchema,
  start_time:      timeOnlySchema.optional(),
  end_time:        timeOnlySchema.optional(),
  location:        z.string().max(500, 'Адрес слишком длинный').optional(),
  importance:      eventImportanceEnum,
  participant_ids: z.array(uuidSchema).max(500, 'Слишком много участников').optional(),
})

export const eventIdSchema = uuidSchema
