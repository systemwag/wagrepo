import { redirect } from 'next/navigation'
import { FolderOpen } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import NewProjectForm from './NewProjectForm'

export default async function NewProjectPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()])

  if (profile?.role === 'employee') redirect('/dashboard/projects')

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name, position')
    .eq('is_active', true)
    .order('full_name')

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        icon={<FolderOpen size={18} />}
        iconTone="green"
        title="Новый проект"
        subtitle="Заполните информацию и настройте этапы работ"
        back={{ href: '/dashboard/projects', label: 'К проектам' }}
      />
      <NewProjectForm employees={employees ?? []} />
    </div>
  )
}
