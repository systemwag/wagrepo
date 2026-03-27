'use client'

import { useEffect } from 'react'
import { savePushSubscription, removePushSubscription } from '@/lib/actions/push'

/** Запрашивает разрешение на push-уведомления и регистрирует подписку */
export function usePushSubscription() {
  useEffect(() => {
    // Push не поддерживается или SW не зарегистрирован
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    // Пользователь уже отказал — не спрашиваем повторно
    if (Notification.permission === 'denied') return

    async function subscribe() {
      try {
        const reg = await navigator.serviceWorker.ready

        // Проверяем, есть ли уже активная подписка
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          // Обновляем в БД (на случай если изменился ключ)
          await savePushSubscription(existing.toJSON() as Parameters<typeof savePushSubscription>[0])
          return
        }

        // Запрашиваем разрешение
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        // Создаём подписку
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ) as unknown as ArrayBuffer,
        })

        await savePushSubscription(sub.toJSON() as Parameters<typeof savePushSubscription>[0])
      } catch (err) {
        // Тихий фейл — не ломаем приложение
        console.warn('[push] subscription failed:', err)
      }
    }

    subscribe()

    // Слушаем сообщение от SW для навигации при клике на уведомление
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'NAVIGATE') {
        window.location.href = event.data.url
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [])
}

/** Отписывает устройство от push-уведомлений */
export async function unsubscribePush() {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await removePushSubscription(sub.endpoint)
  await sub.unsubscribe()
}

// Converts base64url VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
