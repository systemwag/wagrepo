# WAG System — Полный аудит кода

**Дата аудита:** 26.03.2026  
**Версия:** 1.0  
**Статус:** Требуются исправления

---

## Содержание

1. [Критические проблемы](#-критические-проблемы)
2. [Высокий приоритет](#-высокий-приоритет)
3. [Средний приоритет](#-средний-приоритет)
4. [Низкий приоритет](#-низкий-приоритет)
5. [План исправлений](#-план-исправлений)
6. [Статистика](#-статистика)

---

## 🔴 Критические проблемы

### Безопасность (RLS Policies)

| ID | Проблема | Файл | Строки | Описание |
|----|----------|------|--------|----------|
| S1 | Все видят все данные | `supabase/schema.sql` | 183-217 | SELECT policies с `USING (TRUE)` — employee видит ВСЕ проекты и задачи |
| S2 | Нет RLS для stage_checklist_items | `migrations/002_design_stages.sql` | 42-53 | Таблица без политик доступа |
| S3 | SUPABASE_SERVICE_ROLE_KEY в .env.local | `.env.local` | 1-3 | При утечке — полный доступ к БД минуя RLS |
| S4 | Нет валидации в Server Actions | `src/lib/actions/*.ts` | — | assignee_id, priority, status без проверки типов |

#### Детали S1 — Избыточные SELECT policies

```sql
-- ПРОБЛЕМА: Любой сотрудник видит ВСЕ данные
CREATE POLICY "Все видят профили" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "Все видят проекты" ON projects FOR SELECT USING (TRUE);
CREATE POLICY "Все видят этапы" ON project_stages FOR SELECT USING (TRUE);
CREATE POLICY "Все видят задачи" ON tasks FOR SELECT USING (TRUE);
CREATE POLICY "Все видят отчёты" ON task_reports FOR SELECT USING (TRUE);
CREATE POLICY "Все видят документы" ON documents FOR SELECT USING (TRUE);
CREATE POLICY "Все видят лог" ON activity_log FOR SELECT USING (TRUE);
```

**Рекомендация:** Изменить на проверку принадлежности к проекту или роли.

---

### Тесты и CI/CD

| ID | Проблема | Описание |
|----|----------|----------|
| T1 | Нет тестов вообще | 0 unit, 0 integration, 0 e2e тестов |
| T2 | Нет CI/CD | Нет GitHub Actions для lint/build/test |
| T3 | Нет покрытия критических функций | actions, server.ts, middleware не протестированы |

#### Требуется покрыть тестами:

- `src/lib/actions/projects.ts` — deleteProject, deleteStage
- `src/lib/actions/tasks.ts` — createDirectTask, createDirectTaskBulk
- `src/lib/actions/events.ts` — createEvent, updateEvent
- `src/lib/supabase/server.ts` — createClient, getSession, getProfile
- `src/middleware.ts` — авторизация

---

### Типизация

| ID | Проблема | Файл | Строки | Описание |
|----|----------|------|--------|----------|
| T4 | 35+ использований `any` | Разные файлы | — | Опасные нетипизированные данные |
| T5 | Non-null assertions без fallbacks | `server.ts`, `middleware.ts` | 8-12 | `process.env.NEXT_PUBLIC_...!` — крашнет если переменная не задана |

#### Примеры T5:

```typescript
// src/lib/supabase/server.ts:10-11
NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,

// src/middleware.ts:8-9  
SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
```

**Рекомендация:** Добавить проверку и fallback:

```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
```

---

## 🟠 Высокий приоритет

### Производительность

| ID | Проблема | Файл | Строки | Описание |
|----|----------|------|--------|----------|
| P1 | Нет кэширования данных | Все page.tsx | — | +200-500ms на загрузку каждой страницы |
| P2 | N+1 в bulk task creation | `src/lib/actions/tasks.ts` | 61-67 | Последовательные await в цикле |
| P3 | JS-агрегация вместо SQL | `src/app/dashboard/page.tsx` | 388-390, 539-540, 606-607 | Подсчёт статусов задач в цикле |
| P4 | Нет пагинации | `activity/page.tsx`, `projects/page.tsx` | — | Загрузка всех данных сразу |

#### Детали P2 — N+1 Query Problem

```typescript
// src/lib/actions/tasks.ts:61-67
for (let i = 0; i < (tasks ?? []).length; i++) {
  await writeLog(supabase, user.id, 'task', tasks![i].id, 'task.created', {...})
}
```

**Проблема:** При создании 10 задач — 10 последовательных INSERT в activity_log.

**Рекомендация:** Batch insert:

```typescript
const logRows = tasks?.map(task => ({
  actor_id: user.id,
  entity_type: 'task' as const,
  entity_id: task.id,
  action: 'task.created',
  meta: { title: formData.title.trim(), assignee_id: task.assignee_id }
})) ?? []

await supabase.from('activity_log').insert(logRows)
```

#### Детали P1 — Отсутствие кэширования

| Страница | Файл | Статус кэширования |
|----------|------|-------------------|
| Dashboard | `page.tsx` | ❌ Нет |
| Projects | `projects/page.tsx` | ❌ Нет |
| Tasks | `tasks/page.tsx` | ❌ Нет |
| Employees | `employees/page.tsx` | ❌ Нет |
| Events | `events/page.tsx` | ❌ Нет |
| Gantt | `gantt/page.tsx` | ❌ Нет |
| Activity | `activity/page.tsx` | ✅ `revalidate = 30` |
| Daily | `daily/page.tsx` | ✅ `revalidate = 0` |

---

### Код качество

| ID | Проблема | Файл | Строки | Описание |
|----|----------|------|--------|----------|
| Q1 | Дублирование STATUS_CONFIG | 10+ файлов | — | Константы копируются между компонентами |
| Q2 | 8 файлов > 500 строк | Various | — | Сложно поддерживать |
| Q3 | 10 тестовых файлов в проде | `dashboard/test/*` | — | Мусор в продакшене |
| Q4 | Empty catch blocks | `log.ts`, `actions/*.ts` | 17-27, 38-51 | Ошибки игнорируются silently |
| Q5 | alert() вместо UI feedback | `HandoverBoard.tsx` | 46-47, 59 | Плохой UX |

#### Q1 — Дублирование STATUS_CONFIG

| Компонент | Строки |
|----------|--------|
| `src/components/tasks/MyStagesView.tsx` | 67-81, 1051-1062 |
| `src/components/tasks/MyAssignmentsList.tsx` | 21-40 |
| `src/components/planning/ProjectPipelineView.tsx` | 40-49 |
| `src/components/ui/KanbanBoard.tsx` | 42-51 |
| `src/app/dashboard/page.tsx` | 29-34 |

**Рекомендация:** Создать `src/lib/constants/status.ts`:

```typescript
export const STATUS_CONFIG = {
  backlog: { label: 'Бэклог', color: 'gray' },
  todo: { label: 'К выполнению', color: 'blue' },
  in_progress: { label: 'В работе', color: 'yellow' },
  review: { label: 'На проверке', color: 'purple' },
  done: { label: 'Готово', color: 'green' },
} as const
```

#### Q3 — Тестовые файлы (удалить)

```
src/app/dashboard/test/activity-feed/page.tsx
src/app/dashboard/test/bottlenecks/page.tsx
src/app/dashboard/test/daily-report/page.tsx
src/app/dashboard/test/deadlines/page.tsx
src/app/dashboard/test/document-approvals/page.tsx
src/app/dashboard/test/focus-mode/page.tsx
src/app/dashboard/test/handover/page.tsx
src/app/dashboard/test/quick-tasks/page.tsx
src/app/dashboard/test/resource-map/page.tsx
src/app/dashboard/test/templates/page.tsx
src/app/dashboard/deadlines/page.tsx  ← дублирует test/deadlines
```

---

### База данных

| ID | Проблема | Файл | Описание |
|----|----------|------|----------|
| D1 | Нет индексов | `documents(project_id)`, `activity_log(entity_type)` | Медленные запросы при фильтрации |
| D2 | Нет CHECK constraints | `budget`, `estimated_hours` | Можно ввести отрицательные значения |
| D3 | Избыточные SELECT policies | `schema.sql` | Все SELECT = TRUE |

#### D1 — Missing Indexes

```sql
-- Требуется добавить индексы:
CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_task_id ON documents(task_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_task_reports_task ON task_reports(task_id);
CREATE INDEX idx_task_reports_author ON task_reports(author_id);
```

#### D2 — Missing CHECK Constraints

```sql
-- Требуется добавить:
ALTER TABLE projects ADD CONSTRAINT budget_positive CHECK (budget >= 0);
ALTER TABLE tasks ADD CONSTRAINT hours_positive CHECK (estimated_hours > 0);
ALTER TABLE documents ADD CONSTRAINT size_positive CHECK (file_size > 0);
```

---

## 🟡 Средний приоритет

### Accessibility

| ID | Проблема | Файл | Строки | Описание |
|----|----------|------|--------|----------|
| A1 | Низкий контраст цветов | `globals.css` | 14 | `--text-dim: #3d5446` на тёмном фоне (< 4.5:1) |
| A2 | Missing aria-labels | `Sidebar.tsx`, Calendar | 596-615, 345 | Нет aria-label на кнопках навигации |
| A3 | Нет keyboard navigation | Calendar, DatePicker | — | tabIndex отсутствует на ячейках |
| A4 | Missing focus-visible styles | `globals.css` | — | Нет глобального `:focus-visible` |

#### A1 — Color Contrast

```css
/* Текущее значение — контраст ~2.5:1 (требуется 4.5:1) */
--text-dim: #3d5446;

/* Рекомендация: использовать более светлый цвет или увеличить font-weight */
--text-dim: #5a7a68;
```

#### A4 — Global Focus Styles

```css
/* Добавить в globals.css */
:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 2px;
}
```

---

### UI/UX

| ID | Проблема | Файл | Строки | Описание |
|----|----------|------|--------|----------|
| U1 | Inline hover handlers | `DatePicker`, `TimePicker` | 101-102, 131-132 | `onMouseEnter/Leave` вместо CSS |
| U2 | No empty state illustrations | `MyStagesView.tsx` | 122-129 | Empty states без визуальных элементов |
| U3 | No loading skeletons | `KanbanBoard`, `project/[id]` | — | Нет skeleton на детальных страницах |
| U4 | Inconsistent icon types | `Sidebar.tsx` | 40-151 | Mix inline SVG и Lucide |

#### U3 — Missing Skeleton Files

```
✅ Есть: loading.tsx для:
- dashboard/page.tsx
- dashboard/projects/page.tsx
- dashboard/tasks/page.tsx
- dashboard/gantt/page.tsx
- dashboard/employees/page.tsx
- dashboard/events/page.tsx

❌ Отсутствует для:
- dashboard/projects/[id]/page.tsx
- dashboard/assign/page.tsx
- dashboard/assignments/page.tsx
```

---

### Документация

| ID | Проблема | Описание |
|----|----------|----------|
| D1 | README.md — шаблон | Нет информации о WAG System |
| D2 | Нет CONTRIBUTING.md | Неясно как контрибьютить |
| D3 | Нет JSDoc | 0 комментариев в коде |
| D4 | Нет .env.example | Непонятно какие переменные нужны |

---

## 🟢 Низкий приоритет

| Категория | Проблемы |
|-----------|----------|
| **Soft delete** | Нет механизма мягкого удаления (deleted_at) |
| **Cascade delete** | При удалении проекта stage documents в Storage не удаляются |
| **Timestamps** | Непоследовательное использование created_at/updated_at |
| **Mobile** | Некоторые touch targets < 44px в DatePicker |
| **Types** | SpeechRecognition API без TypeScript типов |

---

## 📈 Статистика

| Метрика | Значение |
|---------|----------|
| TypeScript `any` | 35+ |
| Error handling gaps | 20+ |
| Code duplication spots | 10+ |
| Files > 500 lines | 8 |
| Dead code files | 10 |
| RLS policy issues | 7+ |
| Missing indexes | 5+ |
| Missing CHECK constraints | 4+ |

### Файлы более 500 строк

| Файл | Строк |
|------|-------|
| `src/components/events/EventsCalendar.tsx` | ~1400 |
| `src/components/tasks/MyStagesView.tsx` | 1094 |
| `src/components/planning/ProjectPipelineView.tsx` | 1143 |
| `src/components/Sidebar.tsx` | 688 |
| `src/components/assign/AssignTaskList.tsx` | 709 |
| `src/components/assign/AssignTaskForm.tsx` | 626 |
| `src/app/dashboard/page.tsx` | 677 |
| `src/components/daily/DailyReportClient.tsx` | ~918 |

---

## 🎯 План исправлений

### Фаза 1: Критический Security Fix (1-2 дня)

1. **Исправить RLS policies** в `supabase/schema.sql`
   - Заменить `USING (TRUE)` на проверку принадлежности к проекту
   - Добавить RLS для `stage_checklist_items`

2. **Добавить валидацию** в Server Actions
   - Проверка enum значений (priority, status)
   - Проверка существования assignee_id

3. **Создать .env.example**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   # SUPABASE_SERVICE_ROLE_KEY=  # Only for server-side, never client
   ```

4. **Убрать secrets из .env.local в git history** (если уже закоммичены)

---

### Фаза 2: Производительность (2-3 дня)

1. **Добавить кэширование**
   ```typescript
   // Добавить в начало каждого page.tsx
   export const revalidate = 60
   ```

2. **Исправить N+1 в bulk operations**
   - Заменить цикл с await на batch insert

3. **Добавить пагинацию**
   - Activity log: cursor-based pagination
   - Projects: limit + offset

4. **Добавить индексы в БД**
   ```sql
   CREATE INDEX idx_documents_project ON documents(project_id);
   CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);
   ```

---

### Фаза 3: Типизация и качество (2-3 дня)

1. **Убрать все `any`**
   - Создать типы для Supabase join результатов
   - Типизировать NotificationBell
   - Типизировать DailyReportClient

2. **Добавить error handling с UI feedback**
   - Убрать все `console.error`
   - Добавить toast notifications
   - Заменить `alert()` на proper UI

3. **Извлечь дублирующиеся константы**
   ```
   src/lib/constants/
   ├── status.ts       # STATUS_CONFIG, PRIORITY_CONFIG
   ├── stages.ts       # STAGE_COLORS
   └── roles.ts        # role-based navigation config
   ```

4. **Удалить тестовые файлы**
   ```bash
   rm -rf src/app/dashboard/test/
   ```

5. **Разбить большие компоненты**
   - EventsCalendar → CalendarHeader, CalendarGrid, EventCard
   - MyStagesView → StageCard, TaskRow, FilterBar

---

### Фаза 4: UI/UX и Accessibility (2 дня)

1. **Исправить цветовой контраст**
   - `--text-dim` → более светлый оттенок
   - Выходные дни в календаре

2. **Добавить aria-labels**
   - Navigation buttons
   - Icon-only buttons
   - Calendar grid

3. **Создать Skeleton компонент**
   ```typescript
   // src/components/ui/Skeleton.tsx
   export function Skeleton({ className }: { className?: string }) {
     return <div className={`animate-pulse bg-[var(--border)] ${className}`} />
   }
   ```

4. **Добавить пустые состояния с иконками**
   - EmptyTaskList, EmptyProjectList

5. **Унифицировать иконки**
   - Все Lucide, убрать inline SVG из Sidebar

---

### Фаза 5: Тесты и CI (3-4 дня)

1. **Настроить Vitest**
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom
   ```

2. **Написать unit тесты**
   - Server Actions (createDirectTask, updateTaskStatus)
   - Utility functions
   - Component rendering

3. **Настроить GitHub Actions**
   ```yaml
   # .github/workflows/ci.yml
   name: CI
   on: [push, pull_request]
   jobs:
     lint:
       run: npm run lint
     test:
       run: npm test
     build:
       run: npm run build
   ```

4. **Добавить pre-commit hooks**
   ```bash
   npm install -D husky lint-staged
   ```

---

## Чеклист перед мержем

- [ ] Все RLS policies исправлены
- [ ] Нет `any` типов
- [ ] Нет `console.error` / `alert()`
- [ ] Добавлено кэширование на страницах
- [ ] Исправлен N+1 в bulk operations
- [ ] Тестовые файлы удалены
- [ ] Добавлены loading.tsx где отсутствуют
- [ ] Добавлены индексы в БД
- [ ] Тесты проходят
- [ ] CI/CD настроен
