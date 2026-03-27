# CLAUDE.md — WAG System

## О проекте

**WAG System** — внутренняя платформа управления проектами и задачами для West Arlan Group (строительная/инжиниринговая компания, ~40-50 сотрудников). Цель: связать офисный персонал и полевые команды через единый интерфейс с прозрачной отчётностью.

## Стек

- **Frontend:** Next.js (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend/DB:** Supabase (PostgreSQL + Auth + Storage)
- **Иконки:** Lucide React
- **Рендеринг:** Server Components по умолчанию, Client Components — только там, где нужна интерактивность

## Команды

```bash
npm run dev     # dev-сервер на http://localhost:3000
npm run build   # production build
npm start       # запуск production
npm run lint    # линтинг
```

## Переменные окружения (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Структура проекта

```
src/
├── app/                    # Next.js App Router (маршрутизация)
│   ├── login/              # Страница авторизации
│   └── dashboard/          # Защищённые страницы (projects, tasks, employees, gantt, events, assign)
├── components/             # React-компоненты
│   ├── Sidebar.tsx         # Навигация с учётом роли пользователя
│   ├── assign/             # Быстрое назначение задач (только директор)
│   ├── events/             # Компоненты событий/встреч
│   ├── planning/           # Диаграмма Ганта
│   ├── tasks/              # Компоненты задач
│   └── ui/                 # Общие UI-компоненты
└── lib/
    ├── supabase/           # client.ts (браузер), server.ts (сервер + кэш)
    ├── actions/            # Server Actions: projects, tasks, stages, checklist, events
    └── constants/          # Константы

supabase/
├── schema.sql              # Основная схема БД с RLS-политиками
└── migrations/             # Миграции (001–009)
```

## База данных

**Роли пользователей:** `director`, `manager`, `employee`

**Основные таблицы:**
- `profiles` — профили пользователей (расширение auth.users)
- `projects` — проекты со статусом, бюджетом, дедлайном
- `project_stages` — этапы проекта (канбан)
- `tasks` — задачи с приоритетом, дедлайном, исполнителем
- `task_reports` — отчёты по задачам (часы, комментарии)
- `documents` — файлы, прикреплённые к проектам/задачам
- `activity_log` — аудит-лог всех действий
- `events` — корпоративные события/встречи
- `event_participants` — участники событий

**Авторизация полностью делегирована RLS-политикам Postgres.** В коде приложения явных permission-чеков нет — только обращения к БД через Supabase клиент.

## Ключевые паттерны

- **Server Components** для получения данных; `'use client'` только там, где нужен state или обработчики событий
- **Server Actions** в `src/lib/actions/` — вся логика запросов к БД
- **Кэширование:** `unstable_cache` для профилей (60 сек revalidate)
- **Middleware** (`src/middleware.ts`) — cookie-based проверка сессии, редирект на `/login`
- **Путевые алиасы:** `@/*` → `src/*`

## Правила работы с Git

**НИКОГДА не делать `git push` без явной просьбы пользователя.** Коммиты можно создавать, но пуш — только по команде `/git-push` или прямой просьбе "запушь".

## UI-конвенции

- CSS-переменные для тем: `--bg`, `--text`, `--green`, `--border` и др.
- Карточный layout, иконки Lucide
- Сайдбар скрывает пункты меню в зависимости от роли
- Язык интерфейса: **русский**; даты форматируются с `ru-RU` locale
- Имена таблиц/функций — английские; весь UI-текст — русский
