-- ============================================================
-- 024: Оптимизация get_silent_employees_today()
-- ============================================================
-- Проблема: карточка «Не отчитались сегодня» грузилась медленно
-- из-за NOT EXISTS подзапроса без оптимального индекса и без лимита.
--
-- Решение:
--  1) Композитный индекс (report_date, author_id) — для exact-match
--     по сегодняшней дате с включённым автором → index-only scan.
--  2) LEFT JOIN вместо NOT EXISTS — на маленьких таблицах быстрее.
--  3) LIMIT внутри функции — UI всё равно показывает только 6,
--     а догрузить «всех» можно отдельной кнопкой.
-- ============================================================

-- 1) Композитный индекс — для NOT EXISTS / LEFT JOIN по сегодняшнему отчёту
CREATE INDEX IF NOT EXISTS idx_daily_reports_date_author
  ON daily_reports(report_date, author_id);

-- 2) Перепишем функцию: LEFT JOIN + LIMIT
DROP FUNCTION IF EXISTS get_silent_employees_today();

CREATE OR REPLACE FUNCTION get_silent_employees_today(p_limit INT DEFAULT 30)
RETURNS TABLE (
  id          UUID,
  full_name   TEXT,
  role        TEXT,
  "position"  TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.full_name, p.role::TEXT AS role, p.position
    FROM profiles p
    LEFT JOIN daily_reports dr
      ON dr.author_id = p.id
     AND dr.report_date = CURRENT_DATE
   WHERE p.is_active = true
     AND p.role IN ('employee', 'manager')
     AND dr.id IS NULL
   ORDER BY p.full_name
   LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_silent_employees_today(INT) TO authenticated;

-- ANALYZE для обновления статистики после добавления индекса
ANALYZE daily_reports;
ANALYZE profiles;
