export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Service-role клиент: webhook от Supabase приходит без cookies, поэтому SSR-клиент
// с anon-ключом упирается в RLS на push_subscriptions (политика требует
// user_id = auth.uid(), а auth.uid() = NULL без сессии). Маршрут защищён по
// x-webhook-secret, использовать здесь service_role безопасно.
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// URL для перехода при клике на уведомление.
// Типы соответствуют notification_type enum (миграции 011, 013, 026, 050, 051).
function notificationUrl(type: string, linkedId: string | null): string {
  switch (type) {
    case 'project':              return linkedId ? `/dashboard/projects/${linkedId}` : '/dashboard/projects'
    case 'direct_task':          return '/dashboard/assignments'
    case 'project_task':         return '/dashboard/tasks'
    case 'direct_task_feedback': return '/dashboard/assign'
    case 'poll':                 return linkedId ? `/dashboard/polls/${linkedId}` : '/dashboard/polls'
    case 'event':                return '/dashboard/events'
    case 'task':                 return '/dashboard/tasks' // legacy до миграции 026
    default:                     return '/dashboard/notifications'
  }
}

export async function POST(req: NextRequest) {
  // VAPID инициализируется здесь — env недоступны во время билда
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  // Проверяем секретный ключ из заголовка Supabase Webhook
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    type: string
    record: {
      user_id: string
      title: string
      message: string
      type: string
      linked_id: string | null
    }
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Webhook шлёт только INSERT
  if (body.type !== 'INSERT') {
    return NextResponse.json({ ok: true })
  }

  const { user_id, title, message, type, linked_id } = body.record

  // Получаем все push-подписки этого пользователя
  const supabase = createServiceClient()
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user_id)

  if (subsError) {
    console.error('[push] failed to read subscriptions:', subsError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no subscriptions' })
  }

  const payload = JSON.stringify({
    title,
    body:  message,
    url:   notificationUrl(type, linked_id),
    icon:  '/icon-192.png',
  })

  // Отправляем параллельно, удаляем истёкшие подписки (410 Gone)
  const expiredEndpoints: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 86400 } // хранить на push-сервере до 24ч если телефон оффлайн
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          // Подписка устарела — удаляем
          expiredEndpoints.push(sub.endpoint)
        } else {
          // 413/429/5xx — диагностический лог, иначе сбои невидимы
          const body = (err as { body?: string }).body
          console.error('[push] send failed', { status, body })
        }
      }
    })
  )

  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user_id)
      .in('endpoint', expiredEndpoints)
  }

  return NextResponse.json({ ok: true, sent: subs.length - expiredEndpoints.length })
}
