'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { writeLog } from '@/lib/actions/log'
import { requireAuth } from '@/lib/auth'
import {
  closePollSchema,
  createPollSchema,
  deletePollSchema,
  submitPollResponseSchema,
  updatePollSchema,
} from '@/lib/validation/polls'
import { dateOnlySchema, uuidSchema } from '@/lib/validation/common'
import { todayStringOral } from '@/lib/utils/date'

// ─────────────────────────────────────────────────────────────────────────────
// Опросы — см. supabase/migrations/051_polls.sql
// Создать опрос может любой авторизованный сотрудник. Адресат — все или
// конкретные пользователи. Дедлайн обязателен (date-only, до конца дня по Oral).
// Один пользователь — один ответ, переотправить нельзя.
// ─────────────────────────────────────────────────────────────────────────────

type PollType = 'single_choice' | 'multiple_choice' | 'text'
type PollAudience = 'all' | 'specific'

export async function createPoll(formData: {
  question:   string
  type:       PollType
  options?:   { id: string; label: string }[]
  audience:   PollAudience
  target_ids?: string[]
  deadline:   string  // YYYY-MM-DD
}) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = createPollSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  // Дедлайн считаем как конец дня по Asia/Oral (UTC+5).
  const deadlineIso = `${input.deadline}T23:59:59+05:00`

  const { data: poll, error } = await supabase.from('polls').insert({
    created_by: userId,
    question:   input.question,
    type:       input.type,
    options:    input.type === 'text' ? null : input.options ?? [],
    audience:   input.audience,
    deadline:   deadlineIso,
  }).select('id').single()

  if (error) return { error: error.message }

  if (input.audience === 'specific' && input.target_ids && input.target_ids.length > 0) {
    const uniqueTargets = Array.from(new Set(input.target_ids))
    const rows = uniqueTargets.map(user_id => ({ poll_id: poll.id, user_id }))
    const { error: tErr } = await supabase.from('poll_targets').insert(rows)
    if (tErr) return { error: tErr.message }
  }

  await writeLog(supabase, userId, 'poll', poll.id, 'poll.created', {
    question:  input.question,
    type:      input.type,
    audience:  input.audience,
    target_count: input.audience === 'specific' ? input.target_ids?.length ?? 0 : null,
  })

  revalidatePath('/dashboard/polls')
  revalidatePath('/dashboard')
  return { error: null, pollId: poll.id }
}

export async function submitPollResponse(formData: {
  poll_id:              string
  text_answer?:         string
  selected_option_ids?: string[]
}) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = submitPollResponseSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  // Подтянем опрос, чтобы сверить тип ответа с типом опроса.
  const { data: poll, error: pErr } = await supabase
    .from('polls')
    .select('id, type, question, options, created_by, closed_at, deadline')
    .eq('id', input.poll_id)
    .single()
  if (pErr || !poll) return { error: 'Опрос не найден' }

  if (poll.closed_at) return { error: 'Опрос закрыт' }
  if (new Date(poll.deadline).getTime() < Date.now()) return { error: 'Срок ответа истёк' }

  const hasText   = !!(input.text_answer && input.text_answer.trim().length > 0)
  const hasChoice = !!(input.selected_option_ids && input.selected_option_ids.length > 0)

  if (poll.type === 'text' && !hasText)  return { error: 'Введите текстовый ответ' }
  if (poll.type === 'text' && hasChoice) return { error: 'Этот опрос ожидает текстовый ответ' }

  if (poll.type !== 'text' && !hasChoice) return { error: 'Выберите хотя бы один вариант' }
  if (poll.type === 'single_choice' && input.selected_option_ids!.length !== 1) {
    return { error: 'Можно выбрать только один вариант' }
  }
  // Проверяем что переданные option_ids существуют в опросе.
  if (poll.type !== 'text') {
    const validIds = new Set((poll.options as { id: string }[]).map(o => o.id))
    for (const sid of input.selected_option_ids!) {
      if (!validIds.has(sid)) return { error: 'Некорректный вариант ответа' }
    }
  }

  const insertRow = poll.type === 'text'
    ? { poll_id: input.poll_id, user_id: userId, text_answer: input.text_answer!.trim() }
    : { poll_id: input.poll_id, user_id: userId, selected_option_ids: input.selected_option_ids }

  const { error } = await supabase.from('poll_responses').insert(insertRow)
  if (error) {
    // Уникальный конфликт = уже ответил.
    if (error.code === '23505') return { error: 'Вы уже ответили на этот опрос' }
    return { error: error.message }
  }

  await writeLog(supabase, userId, 'poll', input.poll_id, 'poll.responded', {
    question: poll.question,
  })

  // Уведомить автора опроса.
  if (poll.created_by !== userId) {
    await supabase.from('notifications').insert({
      user_id: poll.created_by,
      title:   'Ответ на опрос',
      message: `Получен новый ответ: «${poll.question}»`,
      type:    'poll',
      linked_id: input.poll_id,
    })
  }

  revalidatePath('/dashboard/polls')
  revalidatePath(`/dashboard/polls/${input.poll_id}`)
  revalidatePath('/dashboard')
  return { error: null }
}

/**
 * Редактирование опроса. Доступно автору, директору и админу (RLS).
 * Блокируется, если уже есть ответы — менять формулировку или варианты
 * задним числом некорректно, потому что инвалидирует уже собранные данные.
 */
export async function updatePoll(pollId: string, formData: {
  question:   string
  type:       PollType
  options?:   { id: string; label: string }[]
  audience:   PollAudience
  target_ids?: string[]
  deadline:   string
}) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const idParsed = deletePollSchema.safeParse(pollId)
  if (!idParsed.success) return { error: 'Некорректный идентификатор опроса' }

  const parsed = updatePollSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  // Если на опрос уже отвечали — редактирование запрещено.
  const { count: responseCount } = await supabase
    .from('poll_responses')
    .select('user_id', { count: 'exact', head: true })
    .eq('poll_id', idParsed.data)
  if ((responseCount ?? 0) > 0) {
    return { error: 'Опрос уже получил ответы, редактирование недоступно. Используйте «Закрыть» или «Удалить».' }
  }

  const deadlineIso = `${input.deadline}T23:59:59+05:00`

  const { error } = await supabase.from('polls').update({
    question: input.question,
    type:     input.type,
    options:  input.type === 'text' ? null : input.options ?? [],
    audience: input.audience,
    deadline: deadlineIso,
  }).eq('id', idParsed.data)
  if (error) return { error: error.message }

  // Пересоздаём аудиторию: убираем все старые targets и вставляем новые.
  // RLS позволит автору/директору/админу.
  const { error: delErr } = await supabase.from('poll_targets').delete().eq('poll_id', idParsed.data)
  if (delErr) return { error: delErr.message }

  if (input.audience === 'specific' && input.target_ids && input.target_ids.length > 0) {
    const uniqueTargets = Array.from(new Set(input.target_ids))
    const rows = uniqueTargets.map(user_id => ({ poll_id: idParsed.data, user_id }))
    const { error: insErr } = await supabase.from('poll_targets').insert(rows)
    if (insErr) return { error: insErr.message }
  }

  await writeLog(supabase, userId, 'poll', idParsed.data, 'poll.updated', {
    question: input.question,
    type:     input.type,
    audience: input.audience,
  })

  // Уведомить автора, если правил кто-то другой (директор/админ).
  await notifyAuthorOfManagerAction(supabase, idParsed.data, userId, 'edit')

  revalidatePath('/dashboard/polls')
  revalidatePath(`/dashboard/polls/${idParsed.data}`)
  return { error: null }
}

/** Шлёт notification автору, если опрос правил/закрыл/удалил не он сам. */
async function notifyAuthorOfManagerAction(
  supabase: SupabaseClient,
  pollId: string,
  actorId: string,
  action: 'edit' | 'close' | 'delete',
) {
  // poll к этому моменту мог быть удалён (для action='delete' вызываем ДО delete);
  // для close/edit — он есть. Колл-сайт сам решает в каком порядке вызывать.
  const { data: poll } = await supabase
    .from('polls')
    .select('question, created_by')
    .eq('id', pollId)
    .maybeSingle()
  if (!poll || poll.created_by === actorId) return

  const { data: actor } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', actorId)
    .single()
  const actorName = actor?.full_name ?? 'Администратор'

  const title = action === 'close'  ? 'Опрос закрыт'
              : action === 'delete' ? 'Опрос удалён'
              :                       'Опрос изменён'
  const verb  = action === 'close'  ? 'закрыл'
              : action === 'delete' ? 'удалил'
              :                       'отредактировал'

  await supabase.from('notifications').insert({
    user_id:   poll.created_by,
    title,
    message:   `${actorName} ${verb} ваш опрос: «${poll.question}»`,
    type:      'poll',
    // Для delete linked_id всё равно перестанет работать (страница пропадёт),
    // но кликабельность не критична — главное чтобы автор знал.
    linked_id: action === 'delete' ? null : pollId,
  })
}

export async function closePoll(pollId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = closePollSchema.safeParse(pollId)
  if (!parsed.success) return { error: 'Некорректный идентификатор опроса' }

  const { data: poll } = await supabase.from('polls').select('question').eq('id', parsed.data).single()
  const { error } = await supabase
    .from('polls')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', parsed.data)
  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'poll', parsed.data, 'poll.closed', { question: poll?.question ?? null })

  // Уведомить автора, если закрыл не он.
  await notifyAuthorOfManagerAction(supabase, parsed.data, userId, 'close')

  revalidatePath('/dashboard/polls')
  revalidatePath(`/dashboard/polls/${parsed.data}`)
  return { error: null }
}

export async function deletePoll(pollId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const parsed = deletePollSchema.safeParse(pollId)
  if (!parsed.success) return { error: 'Некорректный идентификатор опроса' }

  const { data: poll } = await supabase.from('polls').select('question').eq('id', parsed.data).single()

  // Уведомляем автора ДО удаления — иначе не сможем достать question/created_by.
  await notifyAuthorOfManagerAction(supabase, parsed.data, userId, 'delete')

  const { error } = await supabase.from('polls').delete().eq('id', parsed.data)
  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'poll', parsed.data, 'poll.deleted', { question: poll?.question ?? null })
  revalidatePath('/dashboard/polls')
  return { error: null }
}

/**
 * Напомнить тем, кто ещё не ответил — отправляет уведомление каждому
 * из аудитории без ответа. Доступно автору, директору и админу
 * (через RLS poll_responses_select + can_see_poll).
 */
export async function remindNotResponded(pollId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error, reminded: 0 }
  const { supabase, userId } = auth

  const idParsed = uuidSchema.safeParse(pollId)
  if (!idParsed.success) return { error: 'Некорректный идентификатор опроса', reminded: 0 }

  const { data: poll } = await supabase
    .from('polls')
    .select('question, audience, created_by, closed_at, deadline')
    .eq('id', idParsed.data)
    .single()
  if (!poll) return { error: 'Опрос не найден', reminded: 0 }
  if (poll.closed_at) return { error: 'Опрос закрыт — напоминание не имеет смысла', reminded: 0 }
  if (new Date(poll.deadline).getTime() < Date.now()) {
    return { error: 'Срок ответа истёк. Сначала продлите дедлайн.', reminded: 0 }
  }

  // Аудитория: либо все активные (минус автор), либо конкретные таргеты.
  let audienceIds: string[] = []
  if (poll.audience === 'all') {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .neq('id', poll.created_by)
    audienceIds = (data ?? []).map(r => (r as { id: string }).id)
  } else {
    const { data } = await supabase
      .from('poll_targets')
      .select('user_id')
      .eq('poll_id', idParsed.data)
    audienceIds = (data ?? []).map(r => (r as { user_id: string }).user_id)
  }

  // Кто уже ответил.
  const { data: responses } = await supabase
    .from('poll_responses')
    .select('user_id')
    .eq('poll_id', idParsed.data)
  const responded = new Set((responses ?? []).map(r => (r as { user_id: string }).user_id))

  const nonResponderIds = audienceIds.filter(uid => !responded.has(uid))
  if (nonResponderIds.length === 0) return { error: null, reminded: 0 }

  const rows = nonResponderIds.map(uid => ({
    user_id: uid,
    title: 'Напоминание об опросе',
    message: `Не забудьте ответить: «${poll.question}»`,
    type: 'poll' as const,
    linked_id: idParsed.data,
  }))
  const { error } = await supabase.from('notifications').insert(rows)
  if (error) return { error: error.message, reminded: 0 }

  await writeLog(supabase, userId, 'poll', idParsed.data, 'poll.reminded', {
    question: poll.question,
    count: nonResponderIds.length,
  })

  revalidatePath(`/dashboard/polls/${idParsed.data}`)
  return { error: null, reminded: nonResponderIds.length }
}

/**
 * Продлить дедлайн (только сам дедлайн, ничего больше). Работает даже когда
 * есть ответы (в отличие от updatePoll). Полезно для просроченных опросов:
 * автор хочет «вернуть к жизни», не меняя сути.
 */
export async function extendPollDeadline(pollId: string, newDeadline: string) {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const { supabase, userId } = auth

  const idParsed = uuidSchema.safeParse(pollId)
  if (!idParsed.success) return { error: 'Некорректный идентификатор опроса' }
  const dateParsed = dateOnlySchema.safeParse(newDeadline)
  if (!dateParsed.success) return { error: 'Дата в неверном формате' }
  if (newDeadline < todayStringOral()) {
    return { error: 'Новый дедлайн не может быть в прошлом' }
  }

  const { data: poll } = await supabase
    .from('polls')
    .select('question, closed_at')
    .eq('id', idParsed.data)
    .single()
  if (!poll) return { error: 'Опрос не найден' }
  if (poll.closed_at) {
    return { error: 'Опрос закрыт. Сначала переоткройте его, потом продлевайте.' }
  }

  const deadlineIso = `${newDeadline}T23:59:59+05:00`
  const { error } = await supabase
    .from('polls')
    .update({ deadline: deadlineIso })
    .eq('id', idParsed.data)
  if (error) return { error: error.message }

  await writeLog(supabase, userId, 'poll', idParsed.data, 'poll.extended', {
    question: poll.question,
    new_deadline: newDeadline,
  })

  // Уведомить автора, если продлил кто-то другой.
  await notifyAuthorOfManagerAction(supabase, idParsed.data, userId, 'edit')

  revalidatePath('/dashboard/polls')
  revalidatePath(`/dashboard/polls/${idParsed.data}`)
  return { error: null }
}
