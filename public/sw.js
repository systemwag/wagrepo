// WAG System Service Worker
const CACHE = 'wag-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Только GET запросы, пропускаем Supabase и API
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return
  if (url.hostname.includes('supabase')) return

  event.respondWith(fetch(event.request))
})
