---
name: rls-audit
description: Проверить безопасность RLS-политик Supabase и Server Actions — нет ли утечек данных между ролями, несанкционированного доступа или пропущенных проверок.
allowed-tools: Read, Grep, Glob
---

# RLS Audit — WAG System

Проведи аудит безопасности. Аргумент `$ARGUMENTS` — конкретная таблица или action-файл для проверки. Если не указан — проверяй весь проект.

## Шаги

### 1. Прочитай схему
Читай `supabase/schema.sql` и файлы из `supabase/migrations/` — ищи все таблицы и их RLS-политики.

### 2. Проверь Server Actions
Читай все файлы из `src/lib/actions/`.

### 3. Проверь компоненты
Ищи прямые обращения к Supabase в компонентах (опасно):
```
Grep: supabase.from( в src/components/ и src/app/
```

---

## Чеклист RLS

### Таблицы
- [ ] Каждая таблица имеет `ENABLE ROW LEVEL SECURITY`
- [ ] Нет таблиц без политик (это блокирует всё — проверь что не забыли добавить SELECT)
- [ ] Политики на INSERT имеют `WITH CHECK`, не только `USING`
- [ ] Директор не может случайно создать запись от имени другого пользователя
- [ ] Нет политики `FOR ALL TO anon` (неаутентифицированный доступ)

### Роли и изоляция
- [ ] `employee` не может читать данные других `employee`
- [ ] `manager` не может видеть проекты других менеджеров
- [ ] `employee` не может менять статус чужих задач
- [ ] Нет таблицы где `employee` видит полный список `profiles` (только нужные поля)

### Server Actions
- [ ] Каждый action начинается с `getUser()` — нет анонимных мутаций
- [ ] После получения user — проверяется role если action только для директора/менеджера
- [ ] Используется `createClient()` из `server.ts`, не из `client.ts`
- [ ] Нет `SUPABASE_SERVICE_ROLE_KEY` в actions (обходит RLS!)
- [ ] `revalidatePath()` вызывается только после успешной мутации

### Клиентский код
- [ ] Нет `supabase.from(...)` в Client Components для записи данных
- [ ] Нет `supabase.from(...)` в Client Components для чтения секретных данных
- [ ] Клиент не передаёт `user.id` как параметр в action (action сам берёт из сессии)

---

## Матрица доступа (заполни по результатам)

| Таблица | director | manager | employee |
|---------|----------|---------|----------|
| profiles | R/W все | R все | R себя |
| projects | R/W все | R/W свои | — |
| project_stages | R/W все | R/W свои проектов | R |
| tasks | R/W все | R/W своих проектов | R/W свои |
| task_reports | R/W все | R своих проектов | R/W свои |
| activity_log | R/W все | — | — |
| events | R/W все | R | R |

Сравни с реальными политиками в схеме.

---

## Формат отчёта

```
## Таблица: tasks

✅ RLS включён
✅ Политика director_all покрывает все операции
⚠️  Политика employee_select: сотрудник видит ВСЕ задачи, а не только свои — намеренно?
🔴 Политика employee_update: нет WITH CHECK — сотрудник может переназначить задачу себе

## Server Action: updateTaskStatus

✅ getUser() вызывается в начале
✅ Использует server client
🔴 Нет проверки что task.assignee_id === user.id для employee роли — полагается только на RLS
```
