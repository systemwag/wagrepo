import type { SupabaseClient } from '@supabase/supabase-js'

export type HandoverEntry = {
  id: string
  kind: 'direct' | 'project'
  title: string
  fromUser: string
  toUser: string
  context: string
  dateSent: string
}

type Lists = {
  incoming: HandoverEntry[]
  outgoing: HandoverEntry[]
}

/**
 * Загружает задачи в статусе todo, где либо я — исполнитель (ждут моего принятия),
 * либо я — создатель (ждут принятия другим). Учитывает обе таблицы: direct_tasks
 * и project_tasks.
 */
export async function queryHandoverLists(
  supabase: SupabaseClient, userId: string,
): Promise<Lists> {
  // Раздельные запросы для incoming/outgoing — incoming идёт через junction
  // (direct_task_assignees + project_task_assignees), чтобы видеть любую
  // задачу с моим участием, не только legacy assignee_id.
  const DIRECT_FIELDS = `
    id, title, status, created_at, assignee_id, created_by,
    creator:profiles!direct_tasks_created_by_fkey(full_name),
    assignee:profiles!direct_tasks_assignee_id_fkey(full_name)
  `
  const PROJECT_FIELDS = `
    id, title, status, created_at, assignee_id, created_by,
    creator:profiles!project_tasks_created_by_fkey(full_name),
    assignee:profiles!project_tasks_assignee_id_fkey(full_name),
    project:projects(name)
  `

  const [
    { data: directIncoming },
    { data: directOutgoing },
    { data: projectIncoming },
    { data: projectOutgoing },
  ] = await Promise.all([
    supabase
      .from('direct_tasks')
      .select(`${DIRECT_FIELDS}, direct_task_assignees!inner(profile_id)`)
      .eq('status', 'todo')
      .eq('direct_task_assignees.profile_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('direct_tasks')
      .select(DIRECT_FIELDS)
      .eq('status', 'todo')
      .eq('created_by', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('project_tasks')
      .select(`${PROJECT_FIELDS}, project_task_assignees!inner(profile_id)`)
      .eq('status', 'todo')
      .eq('project_task_assignees.profile_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('project_tasks')
      .select(PROJECT_FIELDS)
      .eq('status', 'todo')
      .eq('created_by', userId)
      .order('created_at', { ascending: false }),
  ])

  const incoming: HandoverEntry[] = []
  const outgoing: HandoverEntry[] = []

  function single<T>(v: unknown): T | null {
    return Array.isArray(v) ? ((v[0] as T | undefined) ?? null) : ((v as T | null | undefined) ?? null)
  }

  function directEntry(t: { id: string; title: string; created_at: string; creator: unknown; assignee: unknown }): HandoverEntry {
    const creator = single<{ full_name: string }>(t.creator)
    const assignee = single<{ full_name: string }>(t.assignee)
    return {
      id: t.id, kind: 'direct',
      title: t.title,
      fromUser: creator?.full_name ?? 'Неизвестный',
      toUser: assignee?.full_name ?? 'Не назначен',
      context: 'Поручение',
      dateSent: t.created_at,
    }
  }

  for (const t of directIncoming ?? []) incoming.push(directEntry(t))
  for (const t of directOutgoing ?? []) {
    // Не дублируем: incoming уже добавил (если я и автор, и исполнитель — что редко)
    if (t.assignee_id && t.assignee_id !== userId) outgoing.push(directEntry(t))
  }

  function projectEntry(t: { id: string; title: string; created_at: string; creator: unknown; assignee: unknown; project: unknown }): HandoverEntry {
    const creator = single<{ full_name: string }>(t.creator)
    const assignee = single<{ full_name: string }>(t.assignee)
    const proj = single<{ name: string }>(t.project)
    return {
      id: t.id, kind: 'project',
      title: t.title,
      fromUser: creator?.full_name ?? 'Неизвестный',
      toUser: assignee?.full_name ?? 'Не назначен',
      context: proj?.name ?? 'Проект',
      dateSent: t.created_at,
    }
  }

  for (const t of projectIncoming ?? []) incoming.push(projectEntry(t))
  for (const t of projectOutgoing ?? []) {
    if (t.assignee_id && t.assignee_id !== userId) outgoing.push(projectEntry(t))
  }

  return { incoming, outgoing }
}
