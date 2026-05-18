import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import PollForm, { type Employee } from '@/components/polls/PollForm'
import { createPoll } from '@/lib/actions/polls'

export default async function NewPollPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name, position, role')
    .eq('is_active', true)
    .neq('id', profile.id)
    .order('full_name', { ascending: true })

  return (
    <div>
      <PageHeader
        icon={<Plus size={18} />}
        iconTone="green"
        title="Новый опрос"
        subtitle="Сформулируйте вопрос, выберите тип ответа и адресатов"
        back={{ href: '/dashboard/polls', label: 'К опросам' }}
      />
      <div className="card p-6 md:p-7">
        <PollForm
          employees={(employees ?? []) as Employee[]}
          redirectTo="/dashboard/polls"
          onSubmit={createPoll}
        />
      </div>
    </div>
  )
}
