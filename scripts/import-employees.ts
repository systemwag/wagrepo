/**
 * Одноразовый импорт сотрудников West Arlan Group из public/Список сотрудников.xlsx.
 *
 * Запуск:
 *   npm run import:employees
 *
 * Что делает:
 *   1. Для каждого сотрудника создаёт пользователя в Supabase Auth (email + пароль "password").
 *   2. Триггер `handle_new_user` автоматически вставит базовый профиль.
 *   3. Скрипт делает UPSERT с полным набором полей (position, phone, birth_date, role, department).
 *
 * Безопасность:
 *   - Требует SUPABASE_SERVICE_ROLE_KEY (admin API).
 *   - Пароль "password" — временный, пользователи обязаны сменить его сразу после первого входа.
 *
 * Идемпотентность:
 *   - Если auth-пользователь с таким email уже есть — пропускает создание, но обновляет профиль.
 *   - Можно безопасно запускать повторно.
 */

import { createClient } from '@supabase/supabase-js'

type Role = 'director' | 'manager' | 'employee'

type Employee = {
  full_name: string
  position: string | null
  phone: string
  birth_date: string         // YYYY-MM-DD
  email: string
  email_generated: boolean   // true — почта сгенерирована, сообщить сотруднику
  role: Role
  department: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Данные из public/Список сотрудников.xlsx (на момент запуска)
//
// Email сгенерирован для тех, у кого его не было в исходнике — формат
// transliterated_surname@westarlangroup.kz. Пометка email_generated=true.
// ─────────────────────────────────────────────────────────────────────────────

const EMPLOYEES: Employee[] = [
  // ── Руководство ───────────────────────────────────────────────────────────
  {
    full_name: 'Аронов Аян Садиржанович',
    position: 'Генеральный директор',
    phone: '+7 (777) 669 9989',
    birth_date: '1989-04-17',
    email: 'aronov@westarlangroup.kz',
    email_generated: true,
    role: 'director',
    department: 'Руководство',
  },
  {
    full_name: 'Ақдәулетов Айдос Мейірханұлы',
    position: 'Директор по развитию (Учредитель)',
    phone: '+7 (775) 880 8043',
    birth_date: '1981-12-09',
    email: 'akdauletov@westarlangroup.kz',
    email_generated: true,
    role: 'director',
    department: 'Руководство',
  },
  {
    full_name: 'Валеев Алексей Сергеевич',
    position: 'Директор ТОО "Global Construction Project"',
    phone: '+7 (775) 645 9051',
    birth_date: '1987-04-29',
    email: 'toogcp@mail.ru',
    email_generated: false,
    role: 'director',
    department: 'Руководство',
  },
  {
    full_name: 'Прусс Альберт Русланович',
    position: 'Директор по производству',
    phone: '+7 (747) 135 1492',
    birth_date: '1992-07-14',
    email: 'albertpruss2@xmail.ru',
    email_generated: false,
    role: 'director',
    department: 'Руководство',
  },

  // ── Инженерный отдел ──────────────────────────────────────────────────────
  {
    full_name: 'Мартынюк Александр Анатольевич',
    position: 'Главный инженер',
    phone: '+7 (701) 566 2454',
    birth_date: '1969-05-26',
    email: 'aleksandr.mart69@gmail.com',
    email_generated: false,
    role: 'manager',
    department: 'Инженерный',
  },
  {
    full_name: 'Чувильский Станислав Сергеевич',
    position: 'Помощник Главного инженера проекта',
    phone: '+7 (707) 881 8184',
    birth_date: '1989-05-12',
    email: 'stas.chuvilskijj@mail.ru',
    email_generated: false,
    role: 'manager',
    department: 'Инженерный',
  },
  {
    full_name: 'Камалов Амиржан Муханұлы',
    position: 'Инженер ПТО',
    phone: '+7 (707) 317 6065',
    birth_date: '2003-03-31',
    email: 'amoklife228@list.ru',
    email_generated: false,
    role: 'employee',
    department: 'Инженерный',
  },
  {
    full_name: 'Калиев Ислам',
    position: 'Инженер ПТО',
    phone: '+7 (747) 415 3772',
    birth_date: '1999-01-22',
    email: 'islam22.99@mail.ru',
    email_generated: false,
    role: 'employee',
    department: 'Инженерный',
  },
  {
    full_name: 'Николаева Ольга Юрьевна',
    position: 'Инженер - сметчик',
    phone: '+7 (701) 404 7048',
    birth_date: '1965-05-02',
    email: 'nikolaeva-ev@mail.ru',
    email_generated: false,
    role: 'employee',
    department: 'Инженерный',
  },
  {
    full_name: 'Айекешов Айбек Карлович',
    position: 'Инженер по ОТ и ТБ',
    phone: '+7 (701) 675 7781',
    birth_date: '1987-03-10',
    email: 'aiekeshov_ak81@inbox.ru',
    email_generated: false,
    role: 'employee',
    department: 'Инженерный',
  },
  {
    full_name: 'Уразамбетова Гульнара Ахметкаировна',
    position: 'Ведущий инженер технической документации',
    phone: '+7 (747) 102 2213',
    birth_date: '1963-03-21',
    email: 'gulya_urazambetova@mail.ru',
    email_generated: false,
    role: 'manager',
    department: 'Инженерный',
  },

  // ── Проектирование ────────────────────────────────────────────────────────
  {
    full_name: 'Базарбаев Қуаныш Базарбайұлы',
    position: 'Архитектор-проектировщик',
    phone: '+7 (700) 217 1853',
    birth_date: '2005-05-10',
    email: 'kuanysh10052005@mail.ru',
    email_generated: false,
    role: 'employee',
    department: 'Проектирование',
  },
  {
    full_name: 'Абдрахманова Ділназ Қозықызы',
    position: 'Техник по кадастру',
    phone: '+7 (778) 539 2016',
    birth_date: '2004-11-18',
    email: 'dilnaz1811@icloud.com',
    email_generated: false,
    role: 'employee',
    department: 'Проектирование',
  },

  // ── Бухгалтерия ───────────────────────────────────────────────────────────
  {
    full_name: 'Есендьяров Багдат Рашидович',
    position: 'Бухгалтер',
    phone: '+7 (778) 380 2489',
    birth_date: '1989-03-16',
    email: 'ip_esendiarov@mail.ru',
    email_generated: false,
    role: 'employee',
    department: 'Бухгалтерия',
  },
  {
    full_name: 'Кунирбаева Бакытгуль Амировна',
    position: 'Бухгалтер-операционист (специалист по кадрам)',
    phone: '+7 (701) 263 9220',
    birth_date: '1974-03-27',
    email: 'kunirbaeva@bk.ru',
    email_generated: false,
    role: 'employee',
    department: 'Бухгалтерия',
  },

  // ── Офис ──────────────────────────────────────────────────────────────────
  {
    full_name: 'Ковалева Юлия Викторовна',
    position: 'Офис-менеджер',
    phone: '+7 (778) 059 9935',
    birth_date: '1994-07-17',
    email: 'aliwka.juli@gmail.com',
    email_generated: false,
    role: 'employee',
    department: 'Офис',
  },

  // ── Дополнительный персонал ───────────────────────────────────────────────
  {
    full_name: 'Карагулова Гулара Байтурсыновна',
    position: null,
    phone: '+7 (707) 848 0372',
    birth_date: '1962-02-27',
    email: 'karagulova@westarlangroup.kz',
    email_generated: true,
    role: 'employee',
    department: 'Дополнительный персонал',
  },
  {
    full_name: 'Аргумбаев Болат Клбергенович',
    position: null,
    phone: '+7 (701) 641 7479',
    birth_date: '1979-01-17',
    email: 'bolat_arg@mail.ru',
    email_generated: false,
    role: 'employee',
    department: 'Дополнительный персонал',
  },
  {
    full_name: 'Бисенгалиев Нурлан Жакеевич',
    position: null,
    phone: '+7 (701) 252 4418',
    birth_date: '1965-06-14',
    email: 'bisengaliev@westarlangroup.kz',
    email_generated: true,
    role: 'employee',
    department: 'Дополнительный персонал',
  },
  {
    full_name: 'Тажимбет Жулдыз',
    position: null,
    phone: '+7 (747) 300 8010',
    birth_date: '1982-05-08',
    email: 'tazhimbetzhu@gmail.com',
    email_generated: false,
    role: 'employee',
    department: 'Дополнительный персонал',
  },
]

const DEFAULT_PASSWORD = 'password'

// ─────────────────────────────────────────────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Не заданы NEXT_PUBLIC_SUPABASE_URL и/или SUPABASE_SERVICE_ROLE_KEY в .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserByEmail(email: string): Promise<string | null> {
  // listUsers пагинирует; в нашем масштабе хватит первой страницы (1000 по умолчанию).
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  return found?.id ?? null
}

type ImportResult = 'created' | 'updated' | 'failed'

async function importOne(emp: Employee): Promise<ImportResult> {
  const tag = `${emp.full_name} <${emp.email}>`

  // 1. Существует ли уже такой auth user?
  let existingId: string | null
  try {
    existingId = await findUserByEmail(emp.email)
  } catch (e) {
    console.error(`[FAIL ] ${tag}: listUsers — ${(e as Error).message}`)
    return 'failed'
  }

  // 2. Если нет — создаём
  let userId = existingId
  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: emp.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: emp.full_name, role: emp.role },
    })
    if (error || !data.user) {
      console.error(`[FAIL ] ${tag}: createUser — ${error?.message ?? 'no user returned'}`)
      return 'failed'
    }
    userId = data.user.id
  }

  // 3. UPSERT профиля (триггер мог вставить базовую запись — перетираем нужным)
  const { error: pErr } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: emp.full_name,
      position: emp.position,
      phone: emp.phone,
      birth_date: emp.birth_date,
      role: emp.role,
      department: emp.department,
      is_active: true,
    })

  if (pErr) {
    console.error(`[FAIL ] ${tag}: upsert profile — ${pErr.message}`)
    return 'failed'
  }

  const status: ImportResult = existingId ? 'updated' : 'created'
  const genTag = emp.email_generated ? ' [email сгенерирован]' : ''
  console.log(`[ ${status === 'created' ? 'NEW ' : 'UPD '}] ${emp.full_name} → ${emp.email} (${emp.role}, ${emp.department})${genTag}`)
  return status
}

async function main() {
  console.log(`Импорт ${EMPLOYEES.length} сотрудников. Пароль по умолчанию: "${DEFAULT_PASSWORD}"\n`)

  let created = 0, updated = 0, fail = 0
  for (const emp of EMPLOYEES) {
    const r = await importOne(emp)
    if (r === 'created') created++
    else if (r === 'updated') updated++
    else fail++
  }

  console.log(`\nГотово. Создано: ${created}, обновлено: ${updated}, ошибок: ${fail}.`)
  console.log('\nСгенерированные email (сообщи сотрудникам):')
  for (const emp of EMPLOYEES) {
    if (emp.email_generated) console.log(`  ${emp.full_name}: ${emp.email}`)
  }
  console.log(`\nВсе пароли: "${DEFAULT_PASSWORD}" — обязать сменить при первом входе.`)
}

main().catch(e => { console.error(e); process.exit(1) })
