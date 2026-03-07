import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'

// Подавляем предупреждение SDK о getSession() —
// безопасность обеспечивается middleware + RLS политиками Supabase.
const _warn = console.warn.bind(console)
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Using the user object as returned from supabase.auth.getSession()')) return
  _warn(...args)
}

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

// Читаем сессию из cookie — без HTTP запроса к Auth серверу.
// Безопасность данных обеспечивается RLS политиками в Supabase.
export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
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
  const session = await getSession()
  if (!session) return null
  return fetchProfileById(session.user.id)
})
