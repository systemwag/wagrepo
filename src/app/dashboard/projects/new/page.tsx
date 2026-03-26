import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/server'
import Link from 'next/link'
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
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/dashboard/projects" className="text-sm hover-text transition-colors" style={{ color: 'var(--text-muted)' }}>
            Проекты
          </Link>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Новый проект</span>
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Новый проект</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Заполните информацию и настройте этапы работ</p>
      </div>

      <NewProjectForm employees={employees ?? []} />
    </div>
  )
}
