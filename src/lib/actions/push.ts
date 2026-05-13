'use server'

import webpush from 'web-push'
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

export type TestPushResult = {
  ok: boolean
  total: number
  sent: number
  details: { endpointHost: string; ok: boolean; status?: number; error?: string }[]
  error?: string
}

/**
 * Отправляет тестовый push на все подписки текущего пользователя — минуя webhook.
 * Используется для диагностики: что отделяет «push не работает» от «webhook не настроен».
 */
export async function sendTestPushToSelf(): Promise<TestPushResult> {
  const profile = await getProfile()
  if (!profile) {
    return { ok: false, total: 0, sent: 0, details: [], error: 'Не авторизован' }
  }

  if (
    !process.env.VAPID_EMAIL ||
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  ) {
    return { ok: false, total: 0, sent: 0, details: [], error: 'VAPID env не настроены' }
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const supabase = await createClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', profile.id)

  if (!subs || subs.length === 0) {
    return { ok: false, total: 0, sent: 0, details: [], error: 'Нет подписок в БД' }
  }

  const payload = JSON.stringify({
    title: 'WAG — тестовое уведомление',
    body:  'Если вы видите это сообщение в системе — push работает.',
    url:   '/dashboard/notifications',
  })

  const expired: string[] = []
  const details: TestPushResult['details'] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      // Берём только хост endpoint — для UI достаточно увидеть «fcm.googleapis.com» vs «web.push.apple.com»
      let host = sub.endpoint
      try { host = new URL(sub.endpoint).host } catch {}

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 }
        )
        details.push({ endpointHost: host, ok: true })
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        const message = (err as { body?: string; message?: string }).body
          ?? (err as { message?: string }).message
          ?? 'unknown error'
        details.push({ endpointHost: host, ok: false, status, error: message })
        if (status === 410 || status === 404) expired.push(sub.endpoint)
      }
    })
  )

  if (expired.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', profile.id)
      .in('endpoint', expired)
  }

  const sent = details.filter(d => d.ok).length
  return { ok: sent > 0, total: subs.length, sent, details }
}
