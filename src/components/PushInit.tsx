'use client'

import { usePushSubscription } from '@/hooks/usePushSubscription'

/** Подключается к push-уведомлениям. Монтируется один раз в dashboard layout. */
export default function PushInit() {
  usePushSubscription()
  return null
}
