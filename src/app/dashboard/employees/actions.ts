'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getCallerRole() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  return data?.role ?? null
}

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function createEmployee(form: {
  email: string
  password: string
  full_name: string
  role: string
  position: string
  department: string
  birth_date: string
}) {
  const role = await getCallerRole()
  if (role !== 'director') return { error: 'Нет прав' }

  const admin = adminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: form.email,
    password: form.password,
    email_confirm: true,
  })

  if (authError) return { error: authError.message }

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name:  form.full_name,
      role:       form.role,
      position:   form.position   || null,
      department: form.department || null,
      birth_date: form.birth_date || null,
    })
    .eq('id', authData.user.id)

  if (profileError) return { error: profileError.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}

export async function updateEmployee(id: string, form: {
  full_name:  string
  role:       string
  position:   string
  department: string
  birth_date: string
  is_active:  boolean
}) {
  const role = await getCallerRole()
  if (role !== 'director') return { error: 'Нет прав' }

  const admin = adminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      full_name:  form.full_name,
      role:       form.role,
      position:   form.position   || null,
      department: form.department || null,
      birth_date: form.birth_date || null,
      is_active:  form.is_active,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}

export async function deleteEmployee(id: string) {
  const role = await getCallerRole()
  if (role !== 'director') return { error: 'Нет прав' }

  const admin = adminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}
