import { redirect } from 'next/navigation'
import { FolderOpen } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import NewProjectForm, { type TemplateOption } from './NewProjectForm'

export default async function NewProjectPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()])

  if (!profile) redirect('/login')
  if (profile.role === 'employee') redirect('/dashboard/projects')

  // Параллельно: сотрудники + шаблоны (с их этапами для превью)
  const [{ data: employees }, { data: templatesRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, position, role')
      .eq('is_active', true)
      .neq('role', 'admin')
      .order('full_name'),
    supabase
      .from('project_templates')
      .select('id, name, description, icon, color, is_default, stages:template_stages(id, name, order_index)')
      .eq('is_archived', false)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true }),
  ])

  // Сортируем этапы внутри каждого шаблона по order_index
  const templates: TemplateOption[] = (templatesRaw ?? []).map(t => ({
    id:          t.id as string,
    name:        t.name as string,
    description: (t.description as string | null) ?? null,
    icon:        (t.icon as string | null) ?? null,
    color:       (t.color as string | null) ?? null,
    is_default:  Boolean(t.is_default),
    stages: Array.isArray(t.stages)
      ? (t.stages as { id: string; name: string; order_index: number }[])
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
      : [],
  }))

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        icon={<FolderOpen size={18} />}
        iconTone="green"
        title="Новый проект"
        subtitle="Заполните информацию и настройте этапы работ"
        back={{ href: '/dashboard/projects', label: 'К проектам' }}
      />
      <NewProjectForm
        employees={employees ?? []}
        currentUserId={profile.id}
        templates={templates}
      />
    </div>
  )
}
