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
  const [
    { data: rawDirect },
    { data: rawProject },
  ] = await Promise.all([
    supabase
      .from('direct_tasks')
      .select(`
        id, title, status, created_at, assignee_id, created_by,
        creator:profiles!direct_tasks_created_by_fkey(full_name),
        assignee:profiles!direct_tasks_assignee_id_fkey(full_name)
      `)
      .eq('status', 'todo')
      .or(`assignee_id.eq.${userId},created_by.eq.${userId}`)
      .order('created_at', { ascending: false }),

    supabase
      .from('project_tasks')
      .select(`
        id, title, status, created_at, assignee_id, created_by,
        creator:profiles!project_tasks_created_by_fkey(full_name),
        assignee:profiles!project_tasks_assignee_id_fkey(full_name),
        project:projects(name)
      `)
      .eq('status', 'todo')
      .or(`assignee_id.eq.${userId},created_by.eq.${userId}`)
      .order('created_at', { ascending: false }),
  ])

  const incoming: HandoverEntry[] = []
  const outgoing: HandoverEntry[] = []

  function single<T>(v: T | T[] | null | undefined): T | null {
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
  }

  for (const t of rawDirect ?? []) {
    const creator = single<{ full_name: string }>(t.creator)
    const assignee = single<{ full_name: string }>(t.assignee)
    const entry: HandoverEntry = {
      id: t.id, kind: 'direct',
      title: t.title,
      fromUser: creator?.full_name ?? 'Неизвестный',
      toUser: assignee?.full_name ?? 'Не назначен',
      context: 'Поручение',
      dateSent: t.created_at,
    }
    if (t.assignee_id === userId) incoming.push(entry)
    else if (t.created_by === userId && t.assignee_id && t.assignee_id !== userId) outgoing.push(entry)
  }

  for (const t of rawProject ?? []) {
    const creator = single<{ full_name: string }>(t.creator)
    const assignee = single<{ full_name: string }>(t.assignee)
    const proj = single<{ name: string }>(t.project)
    const entry: HandoverEntry = {
      id: t.id, kind: 'project',
      title: t.title,
      fromUser: creator?.full_name ?? 'Неизвестный',
      toUser: assignee?.full_name ?? 'Не назначен',
      context: proj?.name ?? 'Проект',
      dateSent: t.created_at,
    }
    if (t.assignee_id === userId) incoming.push(entry)
    else if (t.created_by === userId && t.assignee_id && t.assignee_id !== userId) outgoing.push(entry)
  }

  return { incoming, outgoing }
}
