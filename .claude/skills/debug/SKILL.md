---
name: debug
description: Системно отладить ошибку в проекте WAG System. Принимает описание проблемы или сообщение об ошибке, находит причину и предлагает исправление.
allowed-tools: Read, Grep, Glob, Bash(npx tsc --noEmit), Bash(npm run build), Bash(git log), Bash(git diff)
---

# Debug — WAG System

Отладь проблему. Аргумент `$ARGUMENTS` — описание ошибки, сообщение из консоли, или URL страницы где проблема.

## Шаги

### 1. Классифицируй ошибку
По тексту из `$ARGUMENTS` определи тип:

| Симптом | Тип | Где искать |
|---------|-----|-----------|
| TypeScript error | Тип/интерфейс | Файл из стектрейса |
| "not found" / 404 | Роутинг | `src/app/` структура |
| Данные не показываются | Supabase query / RLS | Server Component + схема |
| Компонент не обновляется | revalidatePath / Client state | actions + компонент |
| Ошибка на мобиле | CSS / layout | Компонент + globals.css |
| "unauthorized" | Auth / RLS | middleware + политики |
| Билд падает | TypeScript / импорты | Запуск tsc |
| Бесконечный лоадинг | async/await / Suspense | Компонент + action |

### 2. Запусти диагностику
```bash
# TypeScript ошибки
npx tsc --noEmit

# Или полный билд
npm run build
```

### 3. Читай файлы по цепочке
Начни с места где ошибка → трассируй вверх по вызовам:
- UI компонент → Server Action → Supabase query → схема БД

### 4. Проверь типичные причины для WAG System

**Данные не приходят:**
- RLS блокирует? Проверь политики для роли пользователя
- Неправильный join? Проверь `.select('*, relation:table(field)')`
- Кэш? Проверь `revalidate` и `revalidatePath()`
- Server Component пытается использовать browser client?

**TypeScript ошибка `unknown`:**
- JSONB поле `meta` из `activity_log` — нужен каст `(meta as MetaShape)`
- Supabase возвращает `Json` — нужен промежуточный тип

**Компонент не обновляется после мутации:**
- `revalidatePath('/dashboard/...')` вызывается?
- Правильный путь в revalidatePath?
- Client component использует `useState(initialData)` — нужен `useEffect` при смене props?

**Ошибка авторизации:**
- `createClient()` из `server.ts` или `client.ts`?
- В middleware путь добавлен в исключения?
- RLS политика отсутствует для операции?

**Мобильный layout сломан:**
- `min-w-0` на flex-child с `truncate`?
- `pb-24` на main контенте (место под bottom nav)?
- `overflow-x-auto` обёртка вместо `overflow-hidden`?

### 5. Предложи и примени исправление

Покажи:
```
Причина: ...
Файл: src/...
Изменение: было → стало
```

Применяй исправление только если уверен. Если несколько возможных причин — опиши каждую и спроси пользователя.

### 6. Верификация
После исправления:
```bash
npx tsc --noEmit
```
Убедись что ошибок стало меньше, не больше.
