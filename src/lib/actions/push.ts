'use server'

import { createClient, getProfile } from '@/lib/supabase/server'

export type PushSubscriptionJSON = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/** Сохраняет push-подписку устройства в БД (upsert по endpoint) */
export async function savePushSubscription(sub: PushSubscriptionJSON) {
  const profile = await getProfile()
  if (!profile) return

  const supabase = await createClient()
  await supabase.from('push_subscriptions').upsert(
    {
      user_id:  profile.id,
      endpoint: sub.endpoint,
      p256dh:   sub.keys.p256dh,
      auth:     sub.keys.auth,
    },
    { onConflict: 'user_id,endpoint' }
  )
}

/** Удаляет push-подписку (при отписке или смене разрешения) */
export async function removePushSubscription(endpoint: string) {
  const profile = await getProfile()
  if (!profile) return

  const supabase = await createClient()
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', profile.id)
    .eq('endpoint', endpoint)
}
