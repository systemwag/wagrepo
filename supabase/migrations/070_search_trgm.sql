-- ============================================================
-- Migration 070: Нечёткий глобальный поиск (pg_trgm) + RPC search_everything
-- ============================================================
-- Зачем:
--   Раньше globalSearch() в src/lib/actions/search.ts искал через ILIKE
--   '%q%' — точное вхождение подстроки. Опечатка («назарбаев» вместо
--   «Назарбаева») обнуляла выдачу, ранжирования не было, шло 5 отдельных
--   запросов. Здесь: триграммные индексы + один RPC с ранжированием по
--   similarity(). Опечатки и неточные совпадения теперь находятся.
--
-- Безопасность:
--   Функция SECURITY INVOKER (по умолчанию) — НЕ DEFINER. Каждый SELECT
--   внутри исполняется от лица вызывающего, поэтому RLS остаётся
--   единственным стражем данных (как и во всём проекте). Сотрудник не
--   увидит в поиске то, что ему не видно по RLS.
--
-- Заодно: events ищем по колонке date (в старом коде была опечатка
-- events.start_date — такой колонки нет, поиск по событиям молча не работал).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Триграммные GIN-индексы под similarity / ILIKE
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm
  ON projects USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_client_trgm
  ON projects USING gin (client_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_project_tasks_title_trgm
  ON project_tasks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_direct_tasks_title_trgm
  ON direct_tasks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_trgm
  ON profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm
  ON events USING gin (title gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────
-- RPC: единый поиск по 5 сущностям, топ-5 в каждой, с ранжированием.
-- Возвращает унифицированные строки — фронт раскладывает по kind.
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS search_everything(TEXT);

CREATE OR REPLACE FUNCTION search_everything(q TEXT)
RETURNS TABLE (
  kind     TEXT,
  id       UUID,
  title    TEXT,
  subtitle TEXT,
  url      TEXT,
  rank     REAL
)
LANGUAGE sql
STABLE
-- SECURITY INVOKER (по умолчанию): RLS вызывающего применяется к каждому SELECT
SET search_path = public
AS $$
  WITH norm AS (SELECT trim(q) AS q)
  -- Проекты: по названию, заказчику, номеру договора
  (
    SELECT 'project'::TEXT, p.id, p.name,
           NULLIF(concat_ws(' · ', p.client_name, p.contract_number), ''),
           '/dashboard/projects/' || p.id,
           GREATEST(
             similarity(coalesce(p.name, ''),            (SELECT q FROM norm)),
             similarity(coalesce(p.client_name, ''),     (SELECT q FROM norm)),
             similarity(coalesce(p.contract_number, ''), (SELECT q FROM norm))
           )
    FROM projects p, norm
    WHERE p.name % norm.q OR p.client_name % norm.q OR p.contract_number % norm.q
       OR p.name ILIKE '%' || norm.q || '%'
       OR p.client_name ILIKE '%' || norm.q || '%'
       OR p.contract_number ILIKE '%' || norm.q || '%'
    ORDER BY 6 DESC, p.name
    LIMIT 5
  )
  UNION ALL
  -- Задачи проекта
  (
    SELECT 'project_task'::TEXT, t.id, t.title,
           CASE WHEN pr.name IS NOT NULL THEN 'Проект: ' || pr.name ELSE NULL END,
           '/dashboard/projects/' || t.project_id || '?view=tasks',
           similarity(coalesce(t.title, ''), (SELECT q FROM norm))
    FROM project_tasks t
    LEFT JOIN projects pr ON pr.id = t.project_id, norm
    WHERE t.title % norm.q OR t.title ILIKE '%' || norm.q || '%'
    ORDER BY 6 DESC, t.title
    LIMIT 5
  )
  UNION ALL
  -- Поручения
  (
    SELECT 'direct_task'::TEXT, d.id, d.title,
           CASE WHEN a.full_name IS NOT NULL THEN 'Поручение: ' || a.full_name ELSE NULL END,
           '/dashboard/assignments',
           similarity(coalesce(d.title, ''), (SELECT q FROM norm))
    FROM direct_tasks d
    LEFT JOIN profiles a ON a.id = d.assignee_id, norm
    WHERE d.title % norm.q OR d.title ILIKE '%' || norm.q || '%'
    ORDER BY 6 DESC, d.title
    LIMIT 5
  )
  UNION ALL
  -- Сотрудники
  (
    SELECT 'profile'::TEXT, pf.id, pf.full_name,
           NULLIF(concat_ws(' · ', pf.position, pf.department), ''),
           '/dashboard/employees',
           GREATEST(
             similarity(coalesce(pf.full_name, ''), (SELECT q FROM norm)),
             similarity(coalesce(pf.position, ''),  (SELECT q FROM norm))
           )
    FROM profiles pf, norm
    WHERE pf.is_active = true
      AND (pf.full_name % norm.q OR pf.position % norm.q
           OR pf.full_name ILIKE '%' || norm.q || '%'
           OR pf.position ILIKE '%' || norm.q || '%')
    ORDER BY 6 DESC, pf.full_name
    LIMIT 5
  )
  UNION ALL
  -- События (колонка date, не start_date!)
  (
    SELECT 'event'::TEXT, e.id, e.title,
           to_char(e.date, 'DD.MM.YYYY'),
           '/dashboard/events',
           similarity(coalesce(e.title, ''), (SELECT q FROM norm))
    FROM events e, norm
    WHERE e.title % norm.q OR e.title ILIKE '%' || norm.q || '%'
    ORDER BY 6 DESC, e.date DESC
    LIMIT 5
  );
$$;

GRANT EXECUTE ON FUNCTION search_everything(TEXT) TO authenticated;
