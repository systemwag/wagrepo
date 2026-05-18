'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireDirector } from '@/lib/auth'
import {
  createEmployeeSchema,
  departmentNameSchema,
  employeeIdSchema,
  renameDepartmentSchema,
  resetPasswordSchema,
  updateEmployeeSchema,
} from '@/lib/validation/employees'

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
  phone?: string
}) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const parsed = createEmployeeSchema.safeParse(form)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  const admin = adminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  })

  if (authError) return { error: authError.message }

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name:  input.full_name,
      role:       input.role,
      position:   input.position   || null,
      department: input.department || null,
      birth_date: input.birth_date || null,
      phone:      input.phone      || null,
    })
    .eq('id', authData.user.id)

  if (profileError) return { error: profileError.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}

export async function updateEmployee(id: string, form: {
  email?:     string
  full_name:  string
  role:       string
  position:   string
  department: string
  birth_date: string
  phone:      string
  is_active:  boolean
}) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const idParsed = employeeIdSchema.safeParse(id)
  if (!idParsed.success) return { error: 'Некорректный идентификатор сотрудника' }

  const parsed = updateEmployeeSchema.safeParse(form)
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  const admin = adminClient()

  // 1. Если email изменился — обновляем auth.users
  if (input.email && input.email.trim()) {
    const { error: authErr } = await admin.auth.admin.updateUserById(idParsed.data, {
      email: input.email.trim(),
      email_confirm: true,
    })
    if (authErr) return { error: `Email: ${authErr.message}` }
  }

  // 2. Обновляем профиль
  const { error } = await admin
    .from('profiles')
    .update({
      full_name:  input.full_name,
      role:       input.role,
      position:   input.position   || null,
      department: input.department || null,
      birth_date: input.birth_date || null,
      phone:      input.phone      || null,
      is_active:  input.is_active,
    })
    .eq('id', idParsed.data)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}

export async function resetPassword(id: string, password: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const parsed = resetPasswordSchema.safeParse({ id, password })
  if (!parsed.success) {
    return { error: 'Некорректные данные', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data

  const admin = adminClient()
  const { error } = await admin.auth.admin.updateUserById(input.id, { password: input.password })
  if (error) return { error: error.message }

  return { success: true }
}

export async function deleteEmployee(id: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const parsed = employeeIdSchema.safeParse(id)
  if (!parsed.success) return { error: 'Некорректный идентификатор сотрудника' }

  const admin = adminClient()
  const { error } = await admin.auth.admin.deleteUser(parsed.data)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}

export async function deleteDepartment(name: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const parsed = departmentNameSchema.safeParse(name)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Некорректное название отдела' }
  }

  const admin = adminClient()
  const { error } = await admin
    .from('profiles')
    .update({ department: null })
    .eq('department', parsed.data)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}

export async function renameDepartment(oldName: string, newName: string) {
  const auth = await requireDirector()
  if (!auth.ok) return { error: auth.error }

  const parsed = renameDepartmentSchema.safeParse({ oldName, newName })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' }
  }
  const input = parsed.data

  if (input.newName === input.oldName) return { success: true }

  const admin = adminClient()
  const { error } = await admin
    .from('profiles')
    .update({ department: input.newName })
    .eq('department', input.oldName)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/employees')
  return { success: true }
}
