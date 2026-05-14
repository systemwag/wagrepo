import { redirect } from 'next/navigation'
import { ArrowRightLeft } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import HandoverBoard from '@/components/handover/HandoverBoard'
import { queryHandoverLists } from './queries'

export const revalidate = 0

export default async function HandoverPage() {
  const [supabase, profile] = await Promise.all([createClient(), getProfile()])
  if (!profile) redirect('/login')

  const { incoming, outgoing } = await queryHandoverLists(supabase, profile.id)

  return (
    <div>
      <PageHeader
        icon={<ArrowRightLeft size={18} />}
        iconTone="warn"
        title="Перекличка"
        subtitle="Принимайте и отклоняйте поручения с явным подтверждением. Видно, кто что взял в работу."
      />
      <HandoverBoard incoming={incoming} outgoing={outgoing} />
    </div>
  )
}
