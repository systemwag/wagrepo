'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireDirector } from '@/lib/auth'

// Отдельный клиент с service-role-ключом для admin-операций (createUser/deleteUser/...).
// Сами проверки доступа делаются через requireDirector() до его использования.
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
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

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
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

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

export async function resetPassword(id: string, password: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }
  if (password.length < 6) return { error: 'Пароль должен быть не менее 6 символов' }

  const admin = adminClient()
  const { error } = await admin.auth.admin.updateUserById(id, { password })
  if (error) return { error: error.message }

  return { success: true }
}

export async function deleteEmployee(id: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const admin = adminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}

export async function deleteDepartment(name: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const admin = adminClient()
  const { error } = await admin
    .from('profiles')
    .update({ department: null })
    .eq('department', name)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}

export async function renameDepartment(oldName: string, newName: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const trimmed = newName.trim()
  if (!trimmed) return { error: 'Название отдела не может быть пустым' }
  if (trimmed === oldName) return { success: true }

  const admin = adminClient()
  const { error } = await admin
    .from('profiles')
    .update({ department: trimmed })
    .eq('department', oldName)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}
