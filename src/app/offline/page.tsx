'use client'

import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="max-w-md w-full text-center">
        <div
          className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{
            background: 'color-mix(in oklab, var(--color-warn) 10%, transparent)',
            border: '1px solid color-mix(in oklab, var(--color-warn) 25%, transparent)',
            color: 'var(--color-warn)',
          }}
        >
          <WifiOff size={36} strokeWidth={1.6} />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-gold.svg" alt="WAG" className="h-10 mx-auto mb-6 opacity-90" />

        <h1 className="text-2xl font-semibold text-text">Нет подключения к сети</h1>
        <p className="text-sm mt-2 text-text-muted leading-relaxed">
          Не удалось загрузить страницу. Проверьте подключение к интернету —
          ранее открытые страницы доступны из кэша.
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-green mt-6"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  )
}
