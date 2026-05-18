import Link from 'next/link'
import { Activity } from 'lucide-react'
import { Card, CardHeader, CardEmpty } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/server'
import { actionVerb } from '@/lib/constants/activity'
import { formatNameShort } from '@/lib/utils/name'

export default async function RecentActivityCard() {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('activity_log')
    .select('id, action, meta, created_at, actor:profiles!activity_log_actor_id_fkey(id, full_name)')
    .not('action', 'like', '%_audit')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <Card>
      <CardHeader
        icon={<Activity size={18} />}
        title="Последняя активность"
        action={
          <Link href="/dashboard/activity" className="text-xs font-medium text-text-dim hover-green">
            Все →
          </Link>
        }
      />
      {(rows ?? []).length === 0 ? (
        <CardEmpty icon={<Activity size={40} />} text="Активности пока нет" />
      ) : (
        <div>
          {rows!.map((row, i) => {
            type Actor = { id: string; full_name: string }
            const actor = Array.isArray(row.actor) ? (row.actor[0] as Actor) : (row.actor as Actor | null)
            const meta  = (row.meta ?? {}) as Record<string, string>
            const verb  = actionVerb(row.action)
            const title = meta.name ?? meta.title ?? meta.stageName ?? ''
            return (
              <div
                key={row.id}
                className="flex items-start gap-3 px-4 py-3 @md:px-6"
                style={{ borderBottom: i < rows!.length - 1 ? '1px solid var(--color-border)' : undefined }}
              >
                {actor
                  ? <Avatar id={actor.id} name={actor.full_name} size={28} className="mt-0.5 text-xs" />
                  : <div className="w-7 h-7 rounded-lg shrink-0 bg-surface-2 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug text-text">
                    <span className="font-medium">{formatNameShort(actor?.full_name)}</span>
                    {' '}<span className="text-text-muted">{verb}</span>
                    {title && <> <span className="font-medium">«{title}»</span></>}
                  </p>
                  <p className="text-xs mt-0.5 text-text-dim num">
                    {new Date(row.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Oral', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
