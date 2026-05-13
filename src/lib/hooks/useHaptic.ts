'use client'

/**
 * Лёгкий хук для tactile feedback.
 * На устройствах без `navigator.vibrate` (iOS Safari) — no-op.
 * Уважает `prefers-reduced-motion`.
 */
export function useHaptic() {
  function isAllowed() {
    if (typeof window === 'undefined') return false
    if (typeof navigator.vibrate !== 'function') return false
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (mq?.matches) return false
    return true
  }

  return {
    /** Лёгкий клик — для обычных tap-целей (toggle, выбор) */
    tap: () => { if (isAllowed()) navigator.vibrate(8) },
    /** Подтверждение успешного действия */
    success: () => { if (isAllowed()) navigator.vibrate([10, 30, 10]) },
    /** Предупреждение/ошибка */
    error:   () => { if (isAllowed()) navigator.vibrate([20, 60, 20]) },
    /** Триггер (момент достижения порога — например в pull-to-refresh) */
    impact:  () => { if (isAllowed()) navigator.vibrate(15) },
  }
}
