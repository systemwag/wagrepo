# WAG System — Code Review Report

**Дата:** 25.03.2026  
**Ревизор:** Claude Code Review  
**Версия:** 1.0.0

---

## 📊 Общая оценка: ⚠️ Хорошо, требует улучшений

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. Безопасность RLS Политик (schema.sql)

| Таблица | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| profiles | Все | ❌ | Self/Director | Director |
| projects | Все ❌ | Manager/Director | Manager/Director | Director |
| tasks | Все ❌ | Manager/Director | Assignee/Manager/Director | Manager/Director |
| activity_log | Все | **TRUE (любой)** ❌ | — | — |

**Проблемы:**
- `CREATE POLICY "Все видят проекты" ON projects FOR SELECT USING (TRUE);`
- `CREATE POLICY "Система пишет в лог" ON activity_log FOR INSERT WITH CHECK (TRUE);`
  - Любой пользователь может писать фейковые записи в лог активности

**Рекомендация:**
```sql
-- Для projects
CREATE POLICY "Менеджеры видят свои проекты" ON projects FOR SELECT 
USING (created_by = auth.uid() OR manager_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director'));

-- Для activity_log использовать service role key или server-side only
```

---

### 2. Устаревший @supabase/supabase-js

| Пакет | Текущая | Рекомендуемая | Статус |
|-------|---------|---------------|--------|
| @supabase/supabase-js | 2.98.0 | 2.47.x | ❌ MAJOR OUTDATED |

**Рекомендация:** `npm update @supabase/supabase-js @supabase/ssr`

---

### 3. Антипаттерн window.location.reload()

**Файлы:**
- `src/components/ui/HandoverBoard.tsx:140`
- `src/components/ui/DailyReportForm.tsx:98`
- `src/components/tasks/MyStagesView.tsx` (DocumentsPanel)

**Рекомендация:** Заменить на `router.refresh()` или state update

---

### 4. Supabase Console Warning Suppression (server.ts:7-13)

```typescript
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Using the user object')) return
  _warn(...args)
}
```

**Проблема:** Скрывает важное security warning о `getSession()`

**Рекомендация:** Удалить suppression, использовать `getUser()` консистентно

---

## 🟡 СРЕДНИЕ ПРОБЛЕМЫ

### Server Actions (src/lib/actions/)

#### log.ts
```typescript
supabase: any  // ❌ Type safety bypass
// Silent error swallowing - debugging impossible
```

#### tasks.ts
- Нет валидации `status` параметра в `updateTaskStatus`
- Bulk insert logging — N+1 queries
- Race condition в логировании

#### checklist.ts
```typescript
// ❌ Race condition: два concurrent inserts получат одинаковый order_index
const { data: last } = await supabase
  .from('checklist_items')
  .select('order_index')
  .eq('stage_id', stageId)
  .order('order_index', { ascending: false })
  .limit(1)
```

#### events.ts
- Full participant replacement: delete + insert может потерять данные если insert fails
- Нет валидации `EventImportance` enum

#### Все файлы
- ❌ Нет валидации UUID формата
- ❌ Нет валидации enum значений
- ❌ Silent logging failures
- ❌ Нет input length validation

---

### React Components (src/components/)

#### Производительность

| Файл | Строк | Проблема |
|------|-------|----------|
| `EventsCalendar.tsx` | 1173+ | Нет memoization, много useEffect без cleanup |
| `MyStagesView.tsx` | 1097 | Нет memoization, 6+ state updates вызывают re-render |
| `ProjectPipelineView.tsx` | 1143 | Нет memoization, 8+ child компонентов |
| `Sidebar.tsx` | 673 | NavRow re-renders on every state change |
| `AssignTaskList.tsx` | 511 | filtered list computed on every render |

**Рекомендация:**
```typescript
// Добавить useMemo для вычисляемых значений
const filteredTasks = useMemo(() => 
  tasks.filter(t => /* filter logic */), 
  [tasks, statusFilter, employeeFilter]
);

// Обернуть child компоненты в React.memo
const TaskRow = React.memo(({ task }) => <div>{task.title}</div>);
```

#### Дублирование кода

| Компонент 1 | Компонент 2 | Дублируемая логика |
|-------------|-------------|-------------------|
| `DatePicker.tsx` | `AssignTaskForm.tsx` | Calendar picker |
| `MyStagesView.tsx` | `ProjectPipelineView.tsx` | DocumentsPanel, Checklist |

**Рекомендация:** Вынести общие компоненты:
- `src/components/ui/Calendar.tsx`
- `src/components/ui/DocumentsPanel.tsx`

#### Accessibility

| Проблема | Файл | Влияние |
|----------|------|---------|
| Нет `aria-label` на icon buttons | Все компоненты | Screen reader |
| Нет `aria-expanded` | Sidebar, StageCard, Kanban | Screen reader |
| Нет `aria-live` regions | EventsCalendar, Forms | Dynamic updates |
| Нет keyboard navigation | DatePicker, Calendar, Dropdowns | Keyboard users |
| Нет `role="tab"` pattern | BottlenecksDashboard | Tabs не работают |

---

### Pages (src/app/)

#### Отсутствуют loading.tsx
- `/dashboard/assign`
- `/dashboard/assign/new`
- `/dashboard/activity`
- `/dashboard/deadlines`

**Рекомендация:** Создать `loading.tsx` для каждого route

#### Error Handling
- ❌ Нет try/catch для Supabase запросов на всех страницах
- ❌ Нет error.tsx (global error boundary)

**Рекомендация:**
```typescript
// app/dashboard/error.tsx
'use client'
export default function Error({ error, reset }) {
  return (
    <div>
      <p>Что-то пошло не так</p>
      <button onClick={() => reset()}>Попробовать снова</button>
    </div>
  )
}
```

#### Типизация
- ❌ `as any` касты в `projects/[id]/page.tsx`
- ❌ `as HTMLElement` assertion по всему коду

---

## 🟢 МЕЛКИЕ ПРОБЛЕМЫ

### TypeScript (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2017",        // → ES2022
    // Добавить:
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "baseUrl": "."
  }
}
```

### ESLint (eslint.config.mjs)
**Отсутствуют правила:**
- `react-hooks/exhaustive-deps` — HIGH priority
- `@typescript-eslint/no-explicit-any`
- `unused-imports/no-unused-vars`
- `perfectionist/sorted-imports`

**Рекомендация:**
```bash
npm install -D eslint-plugin-react-hooks @typescript-eslint/eslint-plugin
```

### Next.js Config (next.config.ts)
```typescript
const nextConfig: NextConfig = {
  devIndicators: false,
  // Добавить:
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};
```

### Browser Client (client.ts)
```typescript
// Текущее: создаёт новый клиент при каждом вызове
export function createClient() {
  return createBrowserClient(...)
}

// Рекомендация: singleton
let client: ReturnType<typeof createBrowserClient> | null = null
export function createClient() {
  if (!client) {
    client = createBrowserClient(...)
  }
  return client
}
```

---

## 📈 СТАТИСТИКА

| Метрика | Значение |
|---------|----------|
| Файлов проанализировано | ~50 |
| Критических проблем | 4 |
| Средних проблем | 15+ |
| Мелких проблем | 20+ |
| Наибольший файл | 1173+ строк |
| Технический долг | Высокий |

---

## ✅ СИЛЬНЫЕ СТОРОНЫ

- ✅ Server Components / Server Actions — правильная архитектура
- ✅ RLS политики реализованы (хотя требуют доработки)
- ✅ Middleware использует `getUser()` (secure)
- ✅ Tailwind v4 с хорошей темой
- ✅ TypeScript `strict: true`
- ✅ Хорошая структура проекта

---

## 📋 ПЛАН ИСПРАВЛЕНИЙ (ПО ПРИОРИТЕТАМ)

### P0 — Критические (немедленно)
1. [ ] Обновить @supabase/supabase-js
2. [ ] Усилить RLS SELECT политики
3. [ ] Убрать console.warn suppression
4. [ ] Заменить window.location.reload()

### P1 — Высокие (на этой неделе)
5. [ ] Split EventsCalendar.tsx (1173 строк)
6. [ ] Split MyStagesView.tsx (1097 строк)
7. [ ] Split ProjectPipelineView.tsx (1143 строк)
8. [ ] Добавить useMemo/useCallback в списковые компоненты
9. [ ] Создать loading.tsx для всех routes

### P2 — Средние (на следующей неделе)
10. [ ] Добавить error.tsx boundaries
11. [ ] Извлечь общие компоненты (Calendar, DocumentsPanel)
12. [ ] Добавить aria-* атрибуты
13. [ ] Типизировать log.ts supabase параметр
14. [ ] Исправить race condition в checklist

### P3 — Низкие (Tech Debt)
15. [ ] Обновить TypeScript target до ES2022
16. [ ] Добавить ESLint rules
17. [ ] Оптимизировать Next.js config
18. [ ] Исправить все `as any` касты
19. [ ] Добавить Prettier formatting

---

## 📁 ФАЙЛЫ ТРЕБУЮЩИЕ ВНИМАНИЯ

### Высокий приоритет
- `src/lib/supabase/server.ts` — warning suppression
- `supabase/schema.sql` — RLS policies
- `src/components/events/EventsCalendar.tsx` — split needed
- `src/components/tasks/MyStagesView.tsx` — split needed
- `src/components/planning/ProjectPipelineView.tsx` — split needed

### Средний приоритет
- `src/lib/actions/*.ts` — валидация, типизация
- `src/components/ui/*.tsx` — accessibility, memoization
- `src/app/dashboard/*/page.tsx` — error handling

### Низкий приоритет
- `tsconfig.json` — stricter options
- `eslint.config.mjs` — additional rules
- `next.config.ts` — optimizations
