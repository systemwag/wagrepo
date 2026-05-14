import { redirect } from 'next/navigation'
import { Layers } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { hasDirectorAccess } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import TemplatesListClient from './TemplatesListClient'

export default async function TemplatesPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()])

  if (!profile) redirect('/login')
  if (!hasDirectorAccess(profile.role)) redirect('/dashboard')

  // Шаблоны + count этапов внутри + список template_id из projects (для count usage).
  const [{ data: templatesRaw }, { data: projectUsage }] = await Promise.all([
    supabase
      .from('project_templates')
      .select('*, stages:template_stages(id)')
      .order('is_default', { ascending: false })
      .order('is_archived', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('projects')
      .select('template_id')
      .not('template_id', 'is', null),
  ])

  // Считаем сколько проектов использует каждый шаблон
  const usage = new Map<string, number>()
  for (const row of projectUsage ?? []) {
    const id = row.template_id as string | null
    if (!id) continue
    usage.set(id, (usage.get(id) ?? 0) + 1)
  }

  const templates = (templatesRaw ?? []).map(t => ({
    id:          t.id as string,
    name:        t.name as string,
    description: (t.description as string | null) ?? null,
    icon:        (t.icon as string | null) ?? null,
    color:       (t.color as string | null) ?? null,
    is_default:  Boolean(t.is_default),
    is_archived: Boolean(t.is_archived),
    created_at:  t.created_at as string,
    updated_at:  t.updated_at as string,
    stages_count:   Array.isArray(t.stages) ? t.stages.length : 0,
    projects_count: usage.get(t.id as string) ?? 0,
  }))

  return (
    <div>
      <PageHeader
        icon={<Layers size={18} />}
        iconTone="info"
        title="Шаблоны проектов"
        subtitle="Конфигурируемые наборы этапов и чек-листов под разные типы проектов"
        back={{ href: '/dashboard', label: 'На главную' }}
      />
      <TemplatesListClient templates={templates} />
    </div>
  )
}
