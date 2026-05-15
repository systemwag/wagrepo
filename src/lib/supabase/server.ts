import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { User } from '@supabase/supabase-js'

export const createClient = cache(async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — игнорируем
          }
        },
      },
    }
  )
})

// Верификация access-токена через Supabase Auth /user. Кэшируется по самому токену:
// пока токен не сменился (refresh / re-login), Auth-сервер не дёргаем повторно. TTL 60s
// прикрывает крайний случай — деактивация пользователя в Auth должна приходить ≤ через минуту.
// Безопасность данных по-прежнему держит RLS: даже если кэш «протух», Postgres проверяет JWT
// на каждом запросе.
const verifyAccessToken = unstable_cache(
  async (accessToken: string): Promise<User | null> => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as User
  },
  ['supabase-user-verified'],
  { revalidate: 60, tags: ['auth'] }
)

// getUser() — главный вход для Server Components. Шаги:
//   1) getSession() читает access_token из cookie (no network, ~5ms).
//   2) verifyAccessToken() проверяет токен на Auth-сервере, результат закэширован по токену.
// React cache() дедуплицирует вызов в рамках одного запроса.
// До правки: каждая навигация = HTTP к Auth (~200-500ms). После: 1 раз на токен + раз в 60 сек.
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  return verifyAccessToken(session.access_token)
})

const fetchProfileById = unstable_cache(
  async (userId: string) => {
    const supabase = await createClient()
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    return data
  },
  ['profile'],
  // 5 минут — основное узкое место первого SSR-рендера: cold cache miss ходит к Auth+DB.
  // Профиль меняется редко (имя, должность, отдел, телефон); смена пароля идёт через
  // supabase.auth.updateUser и не зависит от этого кэша. При своих правках профиля
  // вызывается revalidatePath/Tag для актуализации.
  { revalidate: 300, tags: ['profile'] }
)

export const getProfile = cache(async () => {
  const user = await getUser()
  if (!user) return null
  return fetchProfileById(user.id)
})
