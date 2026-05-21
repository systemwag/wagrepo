import 'server-only'
import { cookies } from 'next/headers'

export type ToastTone = 'success' | 'error' | 'info' | 'warn'

const COOKIE_NAME = 'wag_toast'

/**
 * Устанавливает flash-cookie с тостом. Клиентский ToastProvider читает её
 * на маунте / смене pathname, показывает уведомление и удаляет cookie.
 *
 * TTL 10 секунд: достаточно, чтобы пережить redirect + первую отрисовку,
 * но не «застрянет» при отказе клиента от чтения. Не httpOnly — клиент должен
 * прочитать и удалить через document.cookie.
 */
export async function setFlashToast(tone: ToastTone, message: string) {
  const c = await cookies()
  c.set(COOKIE_NAME, JSON.stringify({ tone, message }), {
    maxAge: 10,
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
  })
}
