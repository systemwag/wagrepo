import { z } from 'zod'
import { dateOnlySchema, nonEmptyTextSchema, uuidSchema } from './common'
import { todayStringOral } from '@/lib/utils/date'

// ─────────────────────────────────────────────────────────────────────────────
// Опросы (polls). Создаёт любой авторизованный сотрудник. Дедлайн обязателен.
// См. src/lib/actions/polls.ts и миграцию 051.
// ─────────────────────────────────────────────────────────────────────────────

export const pollTypeEnum = z.enum(['single_choice', 'multiple_choice', 'text'])
export const pollAudienceEnum = z.enum(['all', 'specific'])

const pollOptionSchema = z.object({
  id:    z.string().min(1).max(8),
  label: nonEmptyTextSchema(200, 'Вариант ответа'),
})

export const createPollSchema = z
  .object({
    question:    nonEmptyTextSchema(500, 'Вопрос'),
    type:        pollTypeEnum,
    options:     z.array(pollOptionSchema).min(2, 'Нужно минимум 2 варианта').max(20, 'Слишком много вариантов').optional(),
    audience:    pollAudienceEnum,
    target_ids:  z.array(uuidSchema).optional(),
    deadline:    dateOnlySchema,
  })
  .refine(
    v => v.type === 'text' ? v.options === undefined || v.options.length === 0 : !!v.options && v.options.length >= 2,
    { message: 'Для теста нужно минимум 2 варианта ответа', path: ['options'] }
  )
  .refine(
    v => v.audience === 'all' || (v.target_ids && v.target_ids.length > 0),
    { message: 'Выберите хотя бы одного адресата', path: ['target_ids'] }
  )
  // Дедлайн не может быть в прошлом по часовому поясу Oral.
  .refine(
    v => v.deadline >= todayStringOral(),
    { message: 'Дедлайн не может быть в прошлом', path: ['deadline'] }
  )
  // Уникальность id вариантов — на случай скомпрометированного клиента.
  .refine(
    v => !v.options || new Set(v.options.map(o => o.id)).size === v.options.length,
    { message: 'Варианты ответа имеют дублирующиеся идентификаторы', path: ['options'] }
  )

export const submitPollResponseSchema = z
  .object({
    poll_id:             uuidSchema,
    text_answer:         z.string().trim().max(5000, 'Ответ не должен превышать 5000 символов').optional(),
    selected_option_ids: z.array(z.string().min(1).max(8)).optional(),
  })
  .refine(
    v => (v.text_answer && v.text_answer.length > 0) !== !!(v.selected_option_ids && v.selected_option_ids.length > 0),
    { message: 'Ответ должен быть либо текстовым, либо выбором варианта', path: ['text_answer'] }
  )

// Те же правила, что у createPoll — редактирование меняет любые поля.
export const updatePollSchema = createPollSchema

export const closePollSchema = uuidSchema
export const deletePollSchema = uuidSchema
