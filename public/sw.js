// WAG System Service Worker — стратегии для PWA на мобильном
//
// Цели:
//  1. Мгновенный повторный запуск (App Shell + статика из cache).
//  2. Работа при флапающей мобильной сети (offline-fallback).
//  3. Не ломать данные Supabase (всегда сеть, никогда кэш).

const VERSION = 'v8'
const STATIC_CACHE  = `wag-static-${VERSION}`
const RUNTIME_CACHE = `wag-runtime-${VERSION}`
const OFFLINE_URL   = '/offline'

// Лимит на runtime-кэш — чтобы он не разрастался на телефонах сотрудников.
// 80 записей хватает на shell+страницы+картинки одного пользователя,
// дальше выкидываем самые старые (FIFO — cache API хранит в порядке вставки).
const RUNTIME_MAX_ENTRIES = 80

// Минимальный shell, который кладём при установке
const SHELL_URLS = [
  '/manifest.json',
  '/logo.svg',
  '/logo-gold.svg',
  '/logo-mark-gold.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/badge.png',
  '/login',
  OFFLINE_URL,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(c => c.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE && k.startsWith('wag-'))
          .map(k => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

// ─── Стратегии fetch ──────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Никогда не кэшируем Supabase и наши API (динамика, RLS, push)
  if (url.hostname.includes('supabase')) return
  if (url.pathname.startsWith('/api/'))   return

  // Cross-origin (шрифты Google) — stale-while-revalidate в RUNTIME_CACHE
  if (url.origin !== self.location.origin) {
    if (url.hostname.includes('fonts.g')) {
      event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE))
    }
    return
  }

  // Иммутабельная статика Next.js (хеши в URL) — cache-first навсегда
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE))
    return
  }

  // Иконки/лого/манифест — cache-first
  if (
    url.pathname === '/manifest.json' ||
    url.pathname === '/logo.svg' ||
    url.pathname === '/logo-gold.svg' ||
    url.pathname === '/logo-mark-gold.svg' ||
    url.pathname.startsWith('/icon-') ||
    url.pathname === '/badge.png' ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE))
    return
  }

  // HTML-документы (страницы) — network-first, чтобы видеть свежие данные,
  // но иметь fallback в офлайне.
  const isHtml = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')
  if (isHtml) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE))
    return
  }

  // Остальное (CSS/JS без хеша, картинки) — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE))
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const fresh = await fetch(request)
    if (fresh.ok) cache.put(request, fresh.clone())
    return fresh
  } catch {
    return cached || Response.error()
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) {
      await cache.put(request, fresh.clone())
      trimCache(cacheName, RUNTIME_MAX_ENTRIES)
    }
    return fresh
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    // Нет сети и нет кэша — возвращаем нашу offline-страницу из shell
    const offline = await caches.match(OFFLINE_URL)
    if (offline) return offline
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request).then(async fresh => {
    if (fresh.ok) {
      await cache.put(request, fresh.clone())
      trimCache(cacheName, RUNTIME_MAX_ENTRIES)
    }
    return fresh
  }).catch(() => cached || Response.error())
  return cached || fetchPromise
}

// Удаляет самые старые записи кэша, если их больше maxEntries.
// Cache API хранит ключи в порядке вставки, поэтому keys[0] — самый старый.
async function trimCache(cacheName, maxEntries) {
  // Только RUNTIME_CACHE имеет лимит — статика и shell должны оставаться.
  if (cacheName !== RUNTIME_CACHE) return
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  const toDelete = keys.slice(0, keys.length - maxEntries)
  await Promise.all(toDelete.map(k => cache.delete(k)))
}

// ─── Push уведомления ─────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'WAG System', body: event.data.text(), url: '/dashboard' }
  }

  const { title = 'WAG System', body = '', url = '/dashboard/notifications', icon } = payload

  // Каждое уведомление — отдельное (без tag), иначе несколько новых задач
  // схлопываются в одно (у них одинаковый url=/dashboard/tasks).
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192.png',
      badge: '/badge.png',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/dashboard/notifications'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.postMessage({ type: 'NAVIGATE', url: targetUrl })
          return
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

// Сообщение от приложения для skip-waiting (когда пушим новую версию SW)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
