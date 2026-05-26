import { redirect } from 'next/navigation'
import { Plus, Copy } from 'lucide-react'
import { createClient, getProfile } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import PollForm, { type Employee, type PollFormInitial } from '@/components/polls/PollForm'
import { createPoll } from '@/lib/actions/polls'
import { todayStringOral, shiftDateStr } from '@/lib/utils/date'

export default async function NewPollPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const sp = await searchParams
  const fromRaw = Array.isArray(sp?.from) ? sp.from[0] : sp?.from
  // Принимаем UUID. Если мусор — игнорируем (без редиректа, форма откроется пустой).
  const fromId = fromRaw && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fromRaw)
    ? fromRaw
    : null

  const supabase = await createClient()

  // Параллелим: список сотрудников + (если есть from) исходный опрос + его таргеты.
  const [employeesRes, sourceRes, targetsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, position, role')
      .eq('is_active', true)
      .neq('id', profile.id)
      .order('full_name', { ascending: true }),
    fromId
      ? supabase
          .from('polls')
          .select('question, type, options, audience')
          .eq('id', fromId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fromId
      ? supabase
          .from('poll_targets')
          .select('user_id')
          .eq('poll_id', fromId)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ])

  // Начальные значения, если дублируем существующий опрос.
  // Дедлайн НЕ копируем — устанавливаем «через неделю» от сегодня (Oral),
  // потому что оригинальный дедлайн почти наверняка в прошлом и не имеет смысла.
  let initial: PollFormInitial | undefined
  if (sourceRes.data) {
    const src = sourceRes.data as {
      question: string
      type: PollFormInitial['type']
      options: PollFormInitial['options']
      audience: PollFormInitial['audience']
    }
    const target_ids = (targetsRes.data ?? []).map(t => (t as { user_id: string }).user_id)
    initial = {
      question: src.question,
      type:     src.type,
      options:  src.options,
      audience: src.audience,
      target_ids,
      deadline: shiftDateStr(todayStringOral(), 7),
    }
  }

  return (
    <div>
      <PageHeader
        icon={initial ? <Copy size={18} /> : <Plus size={18} />}
        iconTone="green"
        title={initial ? 'Дубликат опроса' : 'Новый опрос'}
        subtitle={initial
          ? 'Текст и адресаты скопированы из оригинала. Дедлайн установлен на неделю вперёд.'
          : 'Сформулируйте вопрос, выберите тип ответа и адресатов'}
        back={{ href: '/dashboard/polls', label: 'К опросам' }}
      />
      <div className="card p-4 md:p-7">
        <PollForm
          employees={(employeesRes.data ?? []) as Employee[]}
          initial={initial}
          redirectTo="/dashboard/polls"
          onSubmit={createPoll}
        />
      </div>
    </div>
  )
}
