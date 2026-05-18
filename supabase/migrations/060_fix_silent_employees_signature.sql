-- ============================================================
-- Migration 060: fix overload-конфликт get_silent_employees_today
-- ============================================================
-- Симптом: SQL вызов `SELECT * FROM get_silent_employees_today()`
-- падает с «function is not unique» (42725). RPC из приложения
-- (`supabase.rpc('get_silent_employees_today')`) возвращает пустой
-- массив, виджет «Без отчёта сегодня» показывает 👌, хотя никто
-- не сдавал.
--
-- Причина: миграция 024 создала функцию с параметром
-- `(p_limit INT DEFAULT 30)`. Моя миграция 058 в попытке
-- timezone-фикса сделала CREATE OR REPLACE FUNCTION без
-- параметров — это новая перегрузка, а не замена. В БД оказались
-- ОБЕ функции, и без явных типов аргументов вызов не выбирает.
--
-- Чиним: DROP обеих, CREATE одной правильной — с p_limit и
-- timezone-aware датой (Asia/Oral), без UTC-bug из 024.
-- ============================================================

DROP FUNCTION IF EXISTS get_silent_employees_today();
DROP FUNCTION IF EXISTS get_silent_employees_today(INT);

CREATE OR REPLACE FUNCTION get_silent_employees_today(p_limit INT DEFAULT 30)
RETURNS TABLE (
  id          UUID,
  full_name   TEXT,
  role        TEXT,
  "position"  TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.role::TEXT AS role, p.position
    FROM profiles p
    LEFT JOIN daily_reports dr
      ON dr.author_id = p.id
     AND dr.report_date = (NOW() AT TIME ZONE 'Asia/Oral')::date
   WHERE p.is_active = true
     AND p.role IN ('employee', 'manager')
     AND dr.id IS NULL
   ORDER BY p.full_name
   LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_silent_employees_today(INT) TO authenticated;
