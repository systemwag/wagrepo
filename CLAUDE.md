# CLAUDE.md — WAG System

## О проекте

**WAG System** — внутренняя платформа управления проектами и задачами для **West Arlan Group** (строительная/инжиниринговая компания, ~40–50 сотрудников, офис в Уральске, Казахстан). Цель — связать офисный персонал и полевые команды через единый интерфейс с прозрачной отчётностью, дейли-планёрками и push-уведомлениями.

## Стек

- **Frontend:** Next.js 16.1 (App Router), React 19.2, TypeScript 5, Tailwind CSS 4
- **Backend/DB:** Supabase (PostgreSQL + Auth + Storage + Realtime + Webhooks)
- **Push:** Web Push API + Service Worker + `web-push` (VAPID)
- **Иконки:** Lucide React
- **Шрифты:** IBM Plex Sans / IBM Plex Mono (через `next/font/google`, cyrillic)
- **Рендеринг:** Server Components по умолчанию, `'use client'` — только там, где нужна интерактивность

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
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:admin@westarlangroup.kz
PUSH_WEBHOOK_SECRET=...        # секрет для авторизации Supabase webhook -> /api/push/notify
```

## Структура проекта

```
src/
├── app/
│   ├── login/                       # Авторизация
│   ├── api/push/notify/route.ts     # Webhook от Supabase, рассылает Web Push (nodejs runtime)
│   └── dashboard/                   # Защищённые страницы
│       ├── layout.tsx               # Авторизация на уровне layout (см. ниже)
│       ├── page.tsx                 # Главный дашборд (виджеты по роли)
│       ├── queries.ts               # Общие запросы для дашборда
│       ├── sections/                # Виджеты дашборда (Events, Birthdays, RecentActivity, SilentEmployees, DailyCta)
│       ├── activity/                # Аудит-лог (только director)
│       ├── assign/                  # Журнал поручений + форма (только director); assign/new
│       ├── assignments/             # Мои поручения (employee/manager)
│       ├── daily/                   # Дейли-отчёт пользователя; daily/team — обзор команды (director)
│       ├── deadlines/               # Светофор дедлайнов (director)
│       ├── employees/               # Сотрудники, роли, должности, отделы (director)
│       ├── events/                  # Календарь событий (все роли)
│       ├── gantt/                   # Диаграмма Ганта (director/manager)
│       ├── notifications/           # История уведомлений
│       ├── projects/                # Список проектов; projects/new; projects/[id] (канбан этапов)
│       └── tasks/                   # Задачи по проектам
├── components/
│   ├── Sidebar.tsx                  # Навигация (фильтр по ролям)
│   ├── NotificationBell.tsx         # Иконка уведомлений
│   ├── NotificationsList.tsx        # Список уведомлений
│   ├── PushInit.tsx                 # Подписка на Web Push
│   ├── ServiceWorkerRegister.tsx    # Регистрация SW + автообновление
│   ├── assign/                      # AssignTaskForm, AssignTaskList, QuickTaskForm
│   ├── daily/                       # DailyReportClient, TeamView
│   ├── events/                      # EventsCalendar
│   ├── planning/                    # ProjectPipelineView, StageProgressBar, StageStatusBadge
│   ├── projects/                    # ProjectCard, ProjectsTable, ProjectsToolbar, StagePipeline и др.
│   ├── tasks/                       # MyAssignmentsList, MyStagesView
│   └── ui/                          # Card, Badge, Alert, ActivityFeed, TrafficLightBoard,
│                                    # HandoverBoard, BottlenecksDashboard, DailyReportForm,
│                                    # DatePicker, TimePicker, LoadMore, PullToRefresh,
│                                    # Skeleton, StatusPill, TransitionLink
└── lib/
    ├── auth.ts                      # requireAuth / requireDirector / requireManager
    ├── supabase/                    # client.ts (браузер), server.ts (сервер + кэш)
    ├── actions/                     # Server Actions (см. ниже)
    ├── constants/                   # design-stages.ts и др.
    ├── hooks/                       # Клиентские React-хуки
    └── utils/
        └── date.ts                  # TZ = 'Asia/Oral', todayStringOral(), todayOral(), currentHourOral()

public/
├── sw.js                            # Service Worker (app-shell + runtime cache + offline-fallback)
├── logo-gold.svg, logo-mark-gold.svg
├── icon-192.png, icon-512.png, apple-touch-icon.png
└── manifest.webmanifest

supabase/
├── schema.sql                       # Базовая схема + RLS
└── migrations/                      # 002..025

scripts/
└── import-employees.ts              # Одноразовый импорт сотрудников из xlsx (npm run import:employees)
```

## Server Actions (`src/lib/actions/`)

- **projects.ts** — CRUD проектов, работа с файлами в storage
- **stages.ts** — смена статусов этапов, логирование
- **tasks.ts** — прямые поручения (createDirectTask/Bulk), статусы задач
- **checklist.ts** — чек-листы этапов (только director/manager пишут — миграция 022)
- **events.ts** — события + участники, триггер уведомлений (миграция 013)
- **daily.ts** — приём дейли-отчёта, автозакрытие задач/этапов
- **log.ts** — writeLog / logActivity в `activity_log`
- **push.ts** — savePushSubscription / removePushSubscription

## База данных

**Роли пользователей:** `director`, `manager`, `employee`.

**Отделы:** поле `profiles.department` (TEXT, миграция 005). Управление в `dashboard/employees/` — переименовать/удалить отдел.

**Основные таблицы:**
- `profiles` — пользователи (расширение auth.users) + `birth_date`, `department`, `position`, `phone` (миграция 025)
- `projects` — проекты со статусом, бюджетом, дедлайном
- `project_stages` — этапы проекта (канбан) + `stage_key`, `start_date` (миграция 020), `review_status`
- `stage_checklist_items` — чек-листы этапов (миграция 002)
- `tasks` — задачи; `project_id` может быть NULL для прямых поручений (миграция 007); `employee_note` (008)
- `task_reports` — отчёты по задачам
- `documents` — файлы, прикреплённые к проектам/задачам/этапам
- `activity_log` — аудит всех действий (все читают — миграция 010)
- `events` + `event_participants` — события (миграция 009, тип `event_importance`)
- `notifications` — уведомления (миграция 011, тип `notification_type`: project/task/system; RLS — только свои, миграция 012)
- `push_subscriptions` — Web Push endpoint+keys по пользователю (миграция 021)
- `daily_reports` + `daily_report_tasks` — дейли-отчёты (миграции 015–017)

**ENUM-типы:** `stage_status`, `review_status`, `project_type`, `event_importance`, `notification_type`.

**SQL-функции для дашборда** (миграции 023–024): `get_my_task_counts`, `get_direct_task_counts`, `get_my_overdue_count`, поиск молчащих сотрудников.

**Realtime:** включён для `tasks` (миграция 014).

**Авторизация полностью делегирована RLS-политикам Postgres.** В коде явных permission-чеков на уровне БД нет — только обращения через Supabase клиент. RLS — единственный страж данных.

## Авторизация маршрутов

**`src/middleware.ts` УДАЛЁН** (с коммита, где middleware был отдельным файлом). Защита сейчас построена так:

- `src/app/dashboard/layout.tsx` — вызывает `getProfile()`; если нет — `redirect('/login')`.
- В каждом `page.tsx` повторно: `if (!profile) redirect('/login')` + при необходимости `if (profile.role !== 'director') redirect('/dashboard')`.
- Хелперы в `src/lib/auth.ts`: `requireAuth()`, `requireDirector()`, `requireManager()`.

## Push-уведомления

Цепочка: Supabase trigger при INSERT в `notifications` → webhook → `/api/push/notify` (проверяет `PUSH_WEBHOOK_SECRET`) → читает `push_subscriptions` → `web-push.sendNotification()` → SW показывает уведомление, при клике открывает `data.url`.

- API route — **обязательно** `export const runtime = 'nodejs'` (web-push не работает в edge).
- При ответе 410 Gone подписка удаляется.
- VAPID `setVapidDetails` — внутри handler, **не** на уровне модуля (иначе билд падает, см. коммит `e04e2d4`).

## Часовой пояс

Бизнес-часовой пояс — **`Asia/Oral` (UTC+5)**. Все «сегодня»-вычисления на сервере — через `todayStringOral()` / `todayOral()` из `src/lib/utils/date.ts`. На клиенте — `toLocaleDateString('ru-RU', { timeZone: 'Asia/Oral', ... })`. Не использовать `new Date()` без TZ для сравнения с дедлайнами.

## Ключевые паттерны

- **Server Components** для получения данных; `'use client'` только для state/обработчиков.
- **Server Actions** в `src/lib/actions/` — вся запись в БД.
- **Кэширование:** `unstable_cache` для профилей (60 сек revalidate).
- **Loading skeletons:** в каждом маршруте есть свой `loading.tsx`.
- **Путевые алиасы:** `@/*` → `src/*`.

## Layout страниц

- Контейнер dashboard задан в `src/app/dashboard/layout.tsx` как `max-w-7xl mx-auto w-full` (1280px) — пэйджи **не оборачивают** в собственный max-width, если только это не форма.
- Формы с большим количеством полей (например, `/projects/new`) могут дополнительно оборачиваться в `<div className="max-w-3xl mx-auto">` для удобства — остальные страницы используют общую ширину layout.
- Все заголовки страниц рендерятся через `<PageHeader>` из `src/components/ui/PageHeader.tsx` — у него единый стиль `text-xl md:text-2xl font-semibold`, цветная иконка в карточке 40×40, опциональные `subtitle`, `back` (ссылка «Назад»), `action` (правая кнопка).
- `loading.tsx` для каждой страницы **обязан** повторять её `max-width` — иначе будет прыжок при стриминге.

## UI-конвенции

- CSS-переменные (см. `src/app/globals.css`): `--color-bg`, `--color-surface`, `--color-border`, `--color-green` (основной акцент), `--color-text`, `--color-text-muted`, `--color-warn`, `--color-danger` и алиасы `--bg`/`--text`/`--green`/`--border`.
- Полупрозрачность — через `color-mix(in oklab, ...)`, не `rgba`.
- Тёмная тема по умолчанию, золотисто-зелёная палитра (логотип `logo-gold.svg`).
- Карточный layout, иконки Lucide (`size 18–24`, `strokeWidth 1.6`).
- Сетки: `grid-cols-1 gap-4 md:gap-6 md:grid-cols-2 xl:grid-cols-3`.
- Мобильный padding: `pb-24 md:pb-8` (под нижнюю навигацию).
- Hover: классы `.hover-surface`, `.hover-green`, `.hover-border`.
- Сайдбар фильтрует пункты по роли.
- Язык интерфейса: **русский**; даты — `ru-RU` локаль + `Asia/Oral`.
- Имена таблиц/функций/полей — английские; весь UI-текст — русский.

## PWA

`public/manifest.webmanifest` + `public/sw.js`. Стратегии SW: app-shell precache (manifest, логотипы, иконки), runtime cache для остального, network-first для `/api/*` и Supabase, offline-fallback на `/offline`. `ServiceWorkerRegister` проверяет обновление каждые 30 минут и перезагружает.

## Правила работы с Git

**НИКОГДА не делать `git push` без явной просьбы пользователя.** Коммиты создавать можно, но пуш — только по команде `/git-push` или прямой просьбе «запушь».
