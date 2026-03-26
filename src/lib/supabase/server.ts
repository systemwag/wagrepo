import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'

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

// getUser() аутентифицирует данные через Supabase Auth сервер — безопасно для Server Components.
// React cache() дедублицирует вызов в рамках одного запроса (~700ms только при cold cache).
export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

const fetchProfileById = unstable_cache(
  async (userId: string) => {
    const supabase = await createClient()
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    return data
  },
  ['profile'],
  { revalidate: 60, tags: ['profile'] }
)

export const getProfile = cache(async () => {
  const user = await getUser()
  if (!user) return null
  return fetchProfileById(user.id)
})
