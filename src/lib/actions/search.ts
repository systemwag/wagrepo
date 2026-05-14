'use server'

import { requireAuth } from '@/lib/auth'

export type SearchProject = {
  kind: 'project'
  id: string
  title: string
  subtitle: string | null
  url: string
}

export type SearchTask = {
  kind: 'project_task' | 'direct_task'
  id: string
  title: string
  subtitle: string | null
  url: string
}

export type SearchProfile = {
  kind: 'profile'
  id: string
  title: string
  subtitle: string | null
  url: string
}

export type SearchEvent = {
  kind: 'event'
  id: string
  title: string
  subtitle: string | null
  url: string
}

export type SearchResult = SearchProject | SearchTask | SearchProfile | SearchEvent

export type SearchResponse = {
  projects:      SearchProject[]
  project_tasks: SearchTask[]
  direct_tasks:  SearchTask[]
  profiles:      SearchProfile[]
  events:        SearchEvent[]
  total: number
}

const LIMIT_PER_KIND = 5

/**
 * Глобальный поиск по системе. Возвращает топ-N в каждой категории.
 * Безопасность через RLS: каждый запрос проходит через клиент пользователя.
 */
export async function globalSearch(rawQuery: string): Promise<SearchResponse> {
  const empty: SearchResponse = {
    projects: [],
    project_tasks: [],
    direct_tasks: [],
    profiles: [],
    events: [],
    total: 0,
  }

  const auth = await requireAuth()
  if (!auth.ok) return empty

  const query = rawQuery.trim()
  if (query.length < 2) return empty
  // ILIKE wildcard — экранируем %, _ чтобы пользовательский ввод не сломал паттерн
  const safe = query.replace(/[%_]/g, ch => `\\${ch}`)
  const like = `%${safe}%`

  const [projectsRes, projectTasksRes, directTasksRes, profilesRes, eventsRes] = await Promise.all([
    auth.supabase
      .from('projects')
      .select('id, name, client_name, contract_number, status')
      .or(`name.ilike.${like},client_name.ilike.${like},contract_number.ilike.${like}`)
      .limit(LIMIT_PER_KIND),
    auth.supabase
      .from('project_tasks')
      .select('id, title, project_id, projects:projects!project_tasks_project_id_fkey(name)')
      .ilike('title', like)
      .limit(LIMIT_PER_KIND),
    auth.supabase
      .from('direct_tasks')
      .select('id, title, assignee:profiles!direct_tasks_assignee_id_fkey(full_name)')
      .ilike('title', like)
      .limit(LIMIT_PER_KIND),
    auth.supabase
      .from('profiles')
      .select('id, full_name, position, department')
      .or(`full_name.ilike.${like},position.ilike.${like}`)
      .eq('is_active', true)
      .limit(LIMIT_PER_KIND),
    auth.supabase
      .from('events')
      .select('id, title, start_date')
      .ilike('title', like)
      .limit(LIMIT_PER_KIND),
  ])

  const projects: SearchProject[] = (projectsRes.data ?? []).map(p => ({
    kind: 'project',
    id: p.id as string,
    title: p.name as string,
    subtitle: [p.client_name, p.contract_number].filter(Boolean).join(' · ') || null,
    url: `/dashboard/projects/${p.id}`,
  }))

  const project_tasks: SearchTask[] = (projectTasksRes.data ?? []).map(t => {
    const proj = Array.isArray(t.projects) ? t.projects[0] : t.projects
    const projectName = (proj as { name?: string } | null)?.name
    return {
      kind: 'project_task',
      id: t.id as string,
      title: t.title as string,
      subtitle: projectName ? `Проект: ${projectName}` : null,
      url: `/dashboard/projects/${t.project_id}?view=tasks`,
    }
  })

  const direct_tasks: SearchTask[] = (directTasksRes.data ?? []).map(t => {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    const assigneeName = (assignee as { full_name?: string } | null)?.full_name
    return {
      kind: 'direct_task',
      id: t.id as string,
      title: t.title as string,
      subtitle: assigneeName ? `Поручение: ${assigneeName}` : null,
      url: `/dashboard/assignments`,
    }
  })

  const profiles: SearchProfile[] = (profilesRes.data ?? []).map(p => ({
    kind: 'profile',
    id: p.id as string,
    title: p.full_name as string,
    subtitle: [p.position, p.department].filter(Boolean).join(' · ') || null,
    url: `/dashboard/employees`,
  }))

  const events: SearchEvent[] = (eventsRes.data ?? []).map(e => ({
    kind: 'event',
    id: e.id as string,
    title: e.title as string,
    subtitle: e.start_date
      ? new Date(e.start_date as string).toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral' })
      : null,
    url: `/dashboard/events`,
  }))

  const total = projects.length + project_tasks.length + direct_tasks.length + profiles.length + events.length

  return { projects, project_tasks, direct_tasks, profiles, events, total }
}
