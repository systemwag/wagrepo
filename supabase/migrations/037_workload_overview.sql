-- ============================================================
-- Migration 037: SQL-функция загрузки команды для дашборда
-- ============================================================
-- Возвращает на каждого активного сотрудника:
--   - in_progress_count: задач в работе (direct + project)
--   - todo_count:        задач в очереди
--   - overdue_count:     просроченных (deadline < today, не done)
--   - wip_limit:         текущий лимит
-- Один SQL-запрос, считается на Postgres — без N round-trips к Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION get_workload_overview()
RETURNS TABLE (
  user_id          UUID,
  full_name        TEXT,
  "position"       TEXT,
  department       TEXT,
  role             TEXT,
  wip_limit        INT,
  in_progress_count INT,
  todo_count       INT,
  overdue_count    INT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  -- direct_tasks: считаем in_progress, todo, overdue per assignee
  d AS (
    SELECT
      assignee_id,
      COUNT(*) FILTER (WHERE status = 'in_progress')::INT AS in_progress,
      COUNT(*) FILTER (WHERE status = 'todo')::INT        AS todo,
      COUNT(*) FILTER (
        WHERE status != 'done'
          AND deadline IS NOT NULL
          AND deadline < CURRENT_DATE
      )::INT AS overdue
    FROM direct_tasks
    WHERE assignee_id IS NOT NULL
    GROUP BY assignee_id
  ),
  -- project_tasks: то же самое
  p AS (
    SELECT
      assignee_id,
      COUNT(*) FILTER (WHERE status = 'in_progress')::INT AS in_progress,
      COUNT(*) FILTER (WHERE status = 'todo')::INT        AS todo,
      COUNT(*) FILTER (
        WHERE status != 'done'
          AND deadline IS NOT NULL
          AND deadline < CURRENT_DATE
      )::INT AS overdue
    FROM project_tasks
    WHERE assignee_id IS NOT NULL
    GROUP BY assignee_id
  )
  SELECT
    pr.id                                            AS user_id,
    pr.full_name                                     AS full_name,
    pr.position                                      AS "position",
    pr.department                                    AS department,
    pr.role::TEXT                                    AS role,
    COALESCE(pr.wip_limit, 5)                        AS wip_limit,
    COALESCE(d.in_progress, 0) + COALESCE(p.in_progress, 0) AS in_progress_count,
    COALESCE(d.todo, 0)        + COALESCE(p.todo, 0)        AS todo_count,
    COALESCE(d.overdue, 0)     + COALESCE(p.overdue, 0)     AS overdue_count
  FROM profiles pr
  LEFT JOIN d ON d.assignee_id = pr.id
  LEFT JOIN p ON p.assignee_id = pr.id
  WHERE pr.is_active = TRUE
    AND pr.role::text != 'admin'  -- admin не учитываем как сотрудника в работе
  ORDER BY pr.full_name;
$$;

GRANT EXECUTE ON FUNCTION get_workload_overview() TO authenticated;
