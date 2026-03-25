---
name: new-page
description: Создать новую страницу в dashboard по паттернам проекта WAG System. Генерирует page.tsx, серверный компонент для данных и клиентский компонент для UI.
allowed-tools: Read, Glob, Grep, Write, Bash(npx tsc --noEmit)
---

# New Page — WAG System

Создай новую страницу dashboard. Аргумент `$ARGUMENTS` — описание страницы, например: `employees/reports — отчёты по сотрудникам, только для директора`.

## Что нужно узнать из $ARGUMENTS
- **Путь**: куда создавать (`/dashboard/...`)
- **Описание**: что делает страница
- **Роли**: кто имеет доступ (`director` / `manager` / `employee`)

Если что-то не указано — спроси у пользователя.

---

## Структура файлов для создания

```
src/app/dashboard/<path>/
└── page.tsx          # Server Component — получает данные, проверяет роль

src/components/<feature>/
└── <Feature>List.tsx  # Client Component — интерактивный UI (если нужен)
```

---

## Шаблон page.tsx

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const revalidate = 30

export default async function <PageName>Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Проверка роли (если нужна)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'director') redirect('/dashboard')

  // Получение данных
  const { data: items } = await supabase
    .from('<table>')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text)' }}>
          <Заголовок>
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          <Описание>
        </p>
      </div>

      <ClientComponent initialData={items ?? []} />
    </div>
  )
}
```

## Шаблон Client Component

```tsx
'use client'

import { useState } from 'react'

type Item = { id: string; /* ... */ }

export default function <Feature>List({ initialData }: { initialData: Item[] }) {
  const [items, setItems] = useState(initialData)

  if (items.length === 0) {
    return (
      <div className="rounded-2xl py-16 text-center" style={{ border: '2px dashed var(--border)' }}>
        <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Данных пока нет</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} className="rounded-2xl p-4 md:p-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {/* контент */}
        </div>
      ))}
    </div>
  )
}
```

---

## Обязательные правила

- **Mobile-first**: все отступы `px-4 md:px-6`, размеры `text-sm md:text-base`
- **Цвета**: только CSS-переменные — `var(--text)`, `var(--surface)`, `var(--green)` и т.д.
- **Роли**: проверяй роль на сервере, не на клиенте
- **Данные**: fetch только в Server Component, клиент получает через props
- **Логирование**: мутации логируются через `writeLog` / `logActivity`
- **Sidebar**: после создания страницы — добавь её в `nav` в `src/components/Sidebar.tsx` если нужно

## После создания

Запусти проверку TypeScript:
```bash
npx tsc --noEmit
```

Сообщи пользователю:
- Какие файлы созданы
- Куда добавить пункт в сайдбар (если нужно)
- Какие таблицы Supabase нужны
