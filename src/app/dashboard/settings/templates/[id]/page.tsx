import { redirect, notFound } from 'next/navigation'
import { Layers, ArrowLeft } from 'lucide-react'
import { getProfile } from '@/lib/supabase/server'
import { hasDirectorAccess } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import { TransitionLink } from '@/components/ui/TransitionLink'
import { fetchTemplate } from '@/lib/actions/templates'
import TemplateEditorClient from './TemplateEditorClient'

export default async function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, getProfile()])

  if (!profile) redirect('/login')
  if (!hasDirectorAccess(profile.role)) redirect('/dashboard')

  const template = await fetchTemplate(id)
  if (!template) notFound()

  return (
    <div>
      <PageHeader
        icon={<Layers size={18} />}
        iconTone="info"
        title={template.name}
        subtitle={template.description ?? 'Этапы и чек-листы шаблона'}
        back={{ href: '/dashboard/settings/templates', label: 'К шаблонам' }}
        action={
          <TransitionLink
            href="/dashboard/settings/templates"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text-muted hover-text hover-surface transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Назад</span>
          </TransitionLink>
        }
      />
      <TemplateEditorClient template={template} />
    </div>
  )
}
