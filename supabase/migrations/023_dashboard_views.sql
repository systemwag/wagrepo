-- ============================================================
-- 023: Views и функции для главного дашборда
-- ============================================================
-- Цель: убрать загрузку сотен строк ради подсчёта статусов и
-- ближайших дней рождения. Считать на стороне Postgres.
--
-- Примечание: `position` — зарезервированное слово в SQL (функция POSITION).
-- В сигнатурах RETURNS TABLE его нужно экранировать двойными кавычками.
-- В JS-результате ключ остаётся `position` без кавычек.
-- ============================================================

-- ── 1. Счётчики задач по статусу для одного assignee ─────────────────────────
-- Используется на дашборде менеджера и сотрудника.
CREATE OR REPLACE FUNCTION get_my_task_counts(p_user_id UUID)
RETURNS TABLE (status TEXT, "count" INT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT t.status::TEXT, COUNT(*)::INT
    FROM tasks t
   WHERE t.assignee_id = p_user_id
   GROUP BY t.status;
$$;

GRANT EXECUTE ON FUNCTION get_my_task_counts(UUID) TO authenticated;

-- ── 2. Счётчики прямых поручений директора ─────────────────────────────────
-- Прямые поручения — задачи без привязки к проекту (project_id IS NULL).
-- Используется на дашборде директора.
CREATE OR REPLACE FUNCTION get_direct_task_counts()
RETURNS TABLE (status TEXT, "count" INT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT t.status::TEXT, COUNT(*)::INT
    FROM tasks t
   WHERE t.project_id IS NULL
   GROUP BY t.status;
$$;

GRANT EXECUTE ON FUNCTION get_direct_task_counts() TO authenticated;

-- ── 3. Просроченные задачи сотрудника (счётчик) ────────────────────────────
CREATE OR REPLACE FUNCTION get_my_overdue_count(p_user_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*)::INT
    FROM tasks
   WHERE assignee_id = p_user_id
     AND status != 'done'
     AND deadline IS NOT NULL
     AND deadline < CURRENT_DATE;
$$;

GRANT EXECUTE ON FUNCTION get_my_overdue_count(UUID) TO authenticated;

-- ── 4. Ближайшие дни рождения (вычисляем next_birthday в SQL) ──────────────
-- Возвращает только тех, у кого ДР в ближайшие N дней. Сортирует по близости.
CREATE OR REPLACE FUNCTION get_upcoming_birthdays(p_days INT DEFAULT 30)
RETURNS TABLE (
  id          UUID,
  full_name   TEXT,
  role        TEXT,
  "position"  TEXT,
  birth_date  DATE,
  days_left   INT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH next_bd AS (
    SELECT
      p.id, p.full_name, p.role::TEXT AS role, p.position, p.birth_date,
      -- Следующий ДР в этом году или в следующем (если уже прошёл)
      CASE
        WHEN make_date(
          EXTRACT(YEAR FROM CURRENT_DATE)::INT,
          EXTRACT(MONTH FROM p.birth_date)::INT,
          EXTRACT(DAY FROM p.birth_date)::INT
        ) >= CURRENT_DATE
        THEN make_date(
          EXTRACT(YEAR FROM CURRENT_DATE)::INT,
          EXTRACT(MONTH FROM p.birth_date)::INT,
          EXTRACT(DAY FROM p.birth_date)::INT
        )
        ELSE make_date(
          EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1,
          EXTRACT(MONTH FROM p.birth_date)::INT,
          EXTRACT(DAY FROM p.birth_date)::INT
        )
      END AS next_bd_date
    FROM profiles p
    WHERE p.birth_date IS NOT NULL
      AND p.is_active = true
  )
  SELECT
    next_bd.id, next_bd.full_name, next_bd.role, next_bd.position, next_bd.birth_date,
    (next_bd.next_bd_date - CURRENT_DATE)::INT AS days_left
  FROM next_bd
  WHERE (next_bd.next_bd_date - CURRENT_DATE) <= p_days
  ORDER BY next_bd.next_bd_date;
$$;

GRANT EXECUTE ON FUNCTION get_upcoming_birthdays(INT) TO authenticated;

-- ── 5. «Кто не отчитался сегодня» — для директора (B4) ─────────────────────
CREATE OR REPLACE FUNCTION get_silent_employees_today()
RETURNS TABLE (
  id          UUID,
  full_name   TEXT,
  role        TEXT,
  "position"  TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.full_name, p.role::TEXT AS role, p.position
    FROM profiles p
   WHERE p.is_active = true
     AND p.role IN ('employee', 'manager')
     AND NOT EXISTS (
       SELECT 1
         FROM daily_reports dr
        WHERE dr.author_id = p.id
          AND dr.report_date = CURRENT_DATE
     )
   ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION get_silent_employees_today() TO authenticated;
