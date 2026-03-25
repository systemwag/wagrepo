---
name: mobile-optimization
description: Проверить и исправить адаптацию под мобильные устройства в Next.js/Tailwind компонентах проекта WAG System.
allowed-tools: Read, Glob, Grep, Edit, Bash(npm run build), Bash(npx tsc --noEmit)
---

# Mobile Optimization — WAG System

Проверь указанный компонент или страницу на мобильную адаптацию и исправь проблемы.

## Аргументы

`$ARGUMENTS` — путь к файлу или директории (опционально). Если не указан — спроси у пользователя что проверить, либо предложи пройтись по всем dashboard страницам.

## Шаги

1. **Прочитай файл** и изучи структуру разметки
2. **Найди проблемы** по чеклисту ниже
3. **Примени исправления** — mobile-first подход (base → md: → lg:)
4. **Проверь сборку**: `npx tsc --noEmit` — должно быть 0 ошибок

## Чеклист проблем

### Отступы и размеры
- Фиксированный padding без мобильного варианта → `px-4 md:px-6`, `py-3 md:py-4`
- Фиксированные ширины (`w-96`, `w-80`) → `w-full md:w-96`
- Фиксированные высоты на контейнерах → убрать или добавить `min-h-`

### Типографика
- Фиксированный `fontSize` в inline style → заменить на `clamp()` или `text-sm md:text-base`
- Крупные заголовки без адаптации → `clamp(1.2rem, 5vw, 2rem)`

### Сетка и Flex
- `grid-cols-2` или `grid-cols-3` без мобильного → `grid-cols-1 md:grid-cols-2`
- `flex-row` без адаптации на узких экранах → `flex-col sm:flex-row`
- `gap-6` без мобильного → `gap-3 md:gap-6`

### Текст и переполнение
- Длинные имена/заголовки без `truncate` → добавить `truncate` + `min-w-0` на flex-child
- Таблицы/строки с множеством колонок → скрывать второстепенные на мобиле (`hidden md:table-cell`)

### Кнопки и касания
- Маленькие кнопки (< 44px) → `min-h-11 px-4`
- Иконки-кнопки без достаточного padding → `p-2`

### Скролл
- Горизонтальный скролл нарушает layout → `overflow-x-auto` + `scroll-x-hidden` или `min-w-0`
- Вкладки/табы не помещаются → `overflow-x-auto scroll-x-hidden flex-shrink-0`

## Паттерны проекта WAG System

```css
/* CSS-переменные (globals.css) */
--bg: #080c0a
--surface: #0d1210
--surface-2: #111916
--border: #1a2620
--border-2: #223020
--green: #22c55e
--text: #e8f5ee
--text-muted: #6b8a78
--text-dim: #3d5446
```

```tsx
// Карточка
<div className="card">  // background: --surface, border: --border, border-radius: 16px

// Кнопка
<button className="btn-green">

// Input
<input className="input">

// Утилиты hover (для server components)
hover-surface, hover-border, hover-text, hover-green, row-hover

// Скрыть горизонтальный скролл
scroll-x-hidden
```

**Breakpoint:** `md:` = 768px — основной переход desktop/mobile.

**Мобильный layout:**
- Dashboard контент: `p-4 md:p-8 pb-24 md:pb-8` — отступ снизу 96px под bottom nav
- Сайдбар: `hidden md:flex` — скрыт на мобиле
- Bottom nav: `md:hidden` — виден только на мобиле, `z-50`

**Safe area (iPhone):**
```css
padding-bottom: max(8px, env(safe-area-inset-bottom))
```

**Fluid sizing:**
```tsx
// Логотип
style={{ height: 'clamp(60px, 18vw, 180px)' }}

// Заголовок
style={{ fontSize: 'clamp(1.5rem, 6vw, 2.4rem)' }}
```

## Типичные исправления

```tsx
// До
<div className="flex gap-6 px-6 py-4">

// После
<div className="flex flex-col sm:flex-row gap-3 md:gap-6 px-4 md:px-6 py-3 md:py-4">
```

```tsx
// До — переполнение имени
<p className="text-sm font-medium">{person.full_name}</p>

// После
<p className="text-sm font-medium truncate">{person.full_name}</p>
// + на родителе: className="flex-1 min-w-0"
```

```tsx
// До — таблица/строка с кучей данных
<div className="flex items-center gap-4">
  <span>{priority}</span>
  <span>{deadline}</span>
  <span>{status}</span>
  <div>{buttons}</div>
</div>

// После — две строки на мобиле
<div>
  <div className="flex items-center gap-2">
    <span className="flex-1 truncate min-w-0">{name}</span>
    <div className="flex-shrink-0">{buttons}</div>
  </div>
  <div className="flex flex-wrap gap-2 mt-1">
    <span>{priority}</span>
    <span>{deadline}</span>
    <span>{status}</span>
  </div>
</div>
```

## Не трогай

- Desktop-only компоненты (диаграмма Ганта — `src/components/planning/`)
- Логику и server actions — только разметку
- Уже адаптированные компоненты без реальных проблем
