import { z } from 'zod'
import { uuidSchema } from './common'

// ─────────────────────────────────────────────────────────────────────────────
// Дейли-отчёты. См. src/lib/actions/daily.ts.
// ─────────────────────────────────────────────────────────────────────────────

// Запись о работе. Ровно одно из direct_task_id / project_task_id / stage_id
// допустимо, либо все NULL (ручной ввод названия). CHECK в БД блокирует
// одновременное direct + project, но и здесь дублируем для ранней ошибки.
//
// `hours_spent` min = 0.1 — БД-CHECK `hours_spent > 0`. До 062 этот контракт
// рассинхрон: zod пропускал 0, БД отвергала. Приводим к одному значению.
export const dailyTaskEntrySchema = z
  .object({
    direct_task_id:  uuidSchema.nullable(),
    project_task_id: uuidSchema.nullable(),
    stage_id:        uuidSchema.nullable(),
    task_title:      z.string().trim().min(1, 'Название работы обязательно').max(500, 'Название слишком длинное'),
    hours_spent:     z.number().min(0.1, 'Часы должны быть больше нуля').max(24, 'Не больше 24 часов в сутки'),
    is_completed:    z.boolean(),
  })
  .refine(
    (t) => !(t.direct_task_id && t.project_task_id),
    { message: 'Запись не может ссылаться одновременно на поручение и проектную задачу', path: ['direct_task_id'] },
  )

// `report_date` — опционален. Если не передан — сервер ставит сегодня по Asia/Oral.
// Если передан — должен быть либо сегодня, либо вчера по Asia/Oral. RLS на БД
// дублирует ограничение (миграция 062), но валидируем здесь для понятной ошибки.
// Формат YYYY-MM-DD.
export const dailyReportInputSchema = z.object({
  did_today:     z.string().trim().min(1, 'Расскажи, что сделал сегодня').max(5000, 'Описание слишком длинное'),
  plan_tomorrow: z.string().max(5000, 'Описание слишком длинное').optional().default(''),
  has_blocker:   z.boolean(),
  blocker_text:  z.string().max(5000, 'Описание блокера слишком длинное').optional().default(''),
  // workload в БД smallint CHECK BETWEEN 1 AND 5
  workload:      z.number().int('Уровень загрузки должен быть целым числом').min(1, 'Минимум 1').max(5, 'Максимум 5'),
  tasks:         z.array(dailyTaskEntrySchema).max(100, 'Слишком много задач в одном отчёте'),
  report_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD').optional(),
})

export const dailyReactionInputSchema = z.object({
  reportId: uuidSchema,
  emoji:    z.string().trim().min(1).max(16),
})

export const dailyReactionRemoveSchema = z.object({
  reportId: uuidSchema,
})
