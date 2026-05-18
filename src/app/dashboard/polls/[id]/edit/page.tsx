import { redirect, notFound } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import PollForm, { type Employee, type PollFormInitial } from '@/components/polls/PollForm'
import { updatePoll } from '@/lib/actions/polls'
import { hasDirectorAccess } from '@/lib/roles'

export default async function EditPollPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const { id } = await params
  const supabase = await createClient()

  // Опрос. RLS не пускает левых.
  const { data: rawPoll } = await supabase
    .from('polls')
    .select('id, question, type, options, audience, deadline, created_by')
    .eq('id', id)
    .single()
  if (!rawPoll) notFound()

  // Право редактировать: автор, директор или админ.
  const canEdit = rawPoll.created_by === profile.id || hasDirectorAccess(profile.role)
  if (!canEdit) redirect(`/dashboard/polls/${id}`)

  // Если уже есть ответы — редактирование заблокировано на уровне server action,
  // но и в UI нет смысла показывать форму.
  const { count: responseCount } = await supabase
    .from('poll_responses')
    .select('user_id', { count: 'exact', head: true })
    .eq('poll_id', id)
  if ((responseCount ?? 0) > 0) redirect(`/dashboard/polls/${id}`)

  // Targets — только если specific.
  const targetIds: string[] = []
  if (rawPoll.audience === 'specific') {
    const { data: targets } = await supabase
      .from('poll_targets')
      .select('user_id')
      .eq('poll_id', id)
    for (const t of targets ?? []) targetIds.push((t as { user_id: string }).user_id)
  }

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name, position, role')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  // Готовим initial: deadline кладём в формате YYYY-MM-DD по TZ Oral.
  const deadlineDate = new Date(rawPoll.deadline)
  const deadlineLocal = deadlineDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Oral' }) // sv-SE → YYYY-MM-DD

  const initial: PollFormInitial = {
    question: rawPoll.question,
    type:     rawPoll.type,
    options:  rawPoll.options as PollFormInitial['options'],
    audience: rawPoll.audience,
    target_ids: targetIds,
    deadline: deadlineLocal,
  }

  // Привязываем pollId к updatePoll: PollForm не знает про id.
  async function submit(payload: Parameters<typeof updatePoll>[1]) {
    'use server'
    return updatePoll(id, payload)
  }

  return (
    <div>
      <PageHeader
        icon={<Pencil size={18} />}
        iconTone="info"
        title="Редактировать опрос"
        subtitle="Изменения вступят сразу после сохранения"
        back={{ href: `/dashboard/polls/${id}`, label: 'К опросу' }}
      />
      <div className="card p-6 md:p-7">
        <PollForm
          employees={(employees ?? []).filter(e => e.id !== profile.id) as Employee[]}
          initial={initial}
          submitLabel="Сохранить изменения"
          redirectTo={`/dashboard/polls/${id}`}
          onSubmit={submit}
        />
      </div>
    </div>
  )
}
