---
name: db-migration
description: Создать новый файл миграции Supabase с правильным номером, структурой и RLS-политиками. Использовать при изменении схемы БД.
allowed-tools: Read, Glob, Write, Bash(ls)
---

# DB Migration — WAG System

Создай новый файл миграции Supabase. Аргумент `$ARGUMENTS` — описание изменения, например: `добавить таблицу comments к задачам`.

## Шаги

### 1. Определи номер миграции
```bash
ls supabase/migrations/
```
Возьми последний номер и добавь 1. Формат: `010_<name>.sql`, `011_<name>.sql` и т.д.

### 2. Прочитай схему для контекста
Прочитай `supabase/schema.sql` чтобы понять существующие таблицы, типы и RLS-паттерны.

### 3. Создай файл миграции

Путь: `supabase/migrations/<номер>_<snake_case_название>.sql`

---

## Шаблон миграции

```sql
-- Migration: <номер> — <описание>
-- Created: <дата YYYY-MM-DD>

-- ── Новая таблица ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS <table_name> (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FK на profiles
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- FK на проекты/задачи если нужно
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  -- поля
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Индексы ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_<table>_user_id    ON <table_name>(user_id);
CREATE INDEX IF NOT EXISTS idx_<table>_project_id ON <table_name>(project_id);
CREATE INDEX IF NOT EXISTS idx_<table>_created_at ON <table_name>(created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- Директор видит всё
CREATE POLICY "<table>_director_all" ON <table_name>
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director')
  );

-- Владелец видит свои записи
CREATE POLICY "<table>_owner_select" ON <table_name>
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Владелец может создавать свои записи
CREATE POLICY "<table>_owner_insert" ON <table_name>
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── Триггер updated_at ─────────────────────────────────────────────────────
CREATE TRIGGER update_<table>_updated_at
  BEFORE UPDATE ON <table_name>
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Паттерны RLS проекта

**Роли:** `director` (всё), `manager` (свои проекты), `employee` (свои задачи)

```sql
-- Проверка роли
EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director')

-- Проверка владельца
user_id = auth.uid()

-- Менеджер видит свои проекты
EXISTS (SELECT 1 FROM projects WHERE id = project_id AND manager_id = auth.uid())

-- Сотрудник видит назначенные задачи
assignee_id = auth.uid()
```

## Правила

- Всегда `IF NOT EXISTS` — миграция должна быть идемпотентной
- Всегда `ON DELETE CASCADE` на FK к profiles и projects
- Всегда `gen_random_uuid()` для id
- Всегда добавлять RLS сразу
- Имена политик: `<table>_<роль>_<действие>`
- Комментарий в начале файла с описанием

## После создания

Сообщи пользователю:
- Путь к созданному файлу
- Как применить: `supabase db push` или через Supabase Dashboard → SQL Editor
- Какие RLS-политики добавлены и что они разрешают
