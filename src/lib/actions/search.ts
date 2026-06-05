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

  // Один RPC вместо 5 запросов: триграммный ранжированный поиск (миграция 070).
  // Функция SECURITY INVOKER — RLS вызывающего применяется, как и везде в проекте.
  const { data, error } = await auth.supabase.rpc('search_everything', { q: query })
  if (error || !data) return empty

  type Row = {
    kind: SearchResult['kind']
    id: string
    title: string
    subtitle: string | null
    url: string
    rank: number
  }

  const projects:      SearchProject[] = []
  const project_tasks: SearchTask[]    = []
  const direct_tasks:  SearchTask[]     = []
  const profiles:      SearchProfile[] = []
  const events:        SearchEvent[]    = []

  for (const row of data as Row[]) {
    const base = { id: row.id, title: row.title, subtitle: row.subtitle, url: row.url }
    switch (row.kind) {
      case 'project':      projects.push({ kind: 'project', ...base }); break
      case 'project_task': project_tasks.push({ kind: 'project_task', ...base }); break
      case 'direct_task':  direct_tasks.push({ kind: 'direct_task', ...base }); break
      case 'profile':      profiles.push({ kind: 'profile', ...base }); break
      case 'event':        events.push({ kind: 'event', ...base }); break
    }
  }

  const total = projects.length + project_tasks.length + direct_tasks.length + profiles.length + events.length

  return { projects, project_tasks, direct_tasks, profiles, events, total }
}
