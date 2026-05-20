'use client'

import { useEffect } from 'react'
import { savePushSubscription, removePushSubscription } from '@/lib/actions/push'

/**
 * Синхронизирует существующую push-подписку с БД при монтировании.
 * НЕ запрашивает разрешение автоматически — браузеры пенализируют такой паттерн,
 * а на iOS он вообще не работает без user-gesture. Для явного включения
 * используйте `requestPushSubscription` из обработчика клика.
 */
export function usePushSubscription() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission !== 'granted') return

    async function sync() {
      try {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()

        if (existing) {
          await savePushSubscription(existing.toJSON() as Parameters<typeof savePushSubscription>[0])
          return
        }

        // permission=granted, но локальной подписки нет — типичный кейс после
        // переустановки браузера / очистки данных / нового устройства.
        // Subscribe без user-gesture разрешён, раз permission уже выдан.
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!key) return
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as unknown as ArrayBuffer,
        })
        await savePushSubscription(sub.toJSON() as Parameters<typeof savePushSubscription>[0])
      } catch (err) {
        console.warn('[push] sync failed:', err)
      }
    }

    sync()

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

/**
 * Запрашивает разрешение и создаёт push-подписку. Должна вызываться только
 * внутри обработчика пользовательского жеста (требование браузеров, особенно iOS).
 * Возвращает true если подписка активна, false при отказе или ошибке.
 */
export async function requestPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) {
    console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing')
    return false
  }

  try {
    const reg = await navigator.serviceWorker.ready

    // Уже подписаны — просто синхронизируем с БД
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      await savePushSubscription(existing.toJSON() as Parameters<typeof savePushSubscription>[0])
      return true
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as unknown as ArrayBuffer,
    })
    await savePushSubscription(sub.toJSON() as Parameters<typeof savePushSubscription>[0])
    return true
  } catch (err) {
    console.warn('[push] subscription failed:', err)
    return false
  }
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
