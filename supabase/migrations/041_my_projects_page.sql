-- ============================================================
-- Migration 041: RPC get_my_projects_page для сотрудника
-- ============================================================
-- Возвращает страницу проектов, в которых пользователь является
-- assignee хотя бы одной задачи (project_tasks) или этапа (project_stages),
-- вместе с total_count и агрегированными этапами в одном запросе.
--
-- Используется на /dashboard/projects для роли employee:
-- избавляет от трёх отдельных RTT к Supabase (getMyProjectIds → count → select)
-- и заменяет одним вызовом.
--
-- Архивные проекты (completed, cancelled) исключаются.
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_projects_page(
  p_user_id UUID,
  p_page    INT,
  p_size    INT
)
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  status          TEXT,
  deadline        DATE,
  start_date      DATE,
  client_name     TEXT,
  contract_number TEXT,
  budget          NUMERIC,
  created_at      TIMESTAMPTZ,
  manager_name    TEXT,
  stages          JSONB,
  total_count     BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH my_pids AS (
    -- Все проекты, в которых пользователь — assignee задачи или этапа.
    -- DISTINCT внутри UNION (UNION без ALL и так уникальный).
    SELECT pt.project_id AS pid
      FROM project_tasks pt
     WHERE pt.assignee_id = p_user_id AND pt.project_id IS NOT NULL
    UNION
    SELECT ps.project_id AS pid
      FROM project_stages ps
     WHERE ps.assignee_id = p_user_id AND ps.project_id IS NOT NULL
  ),
  active_projects AS (
    SELECT p.*
      FROM projects p
      JOIN my_pids mp ON mp.pid = p.id
     WHERE p.status NOT IN ('completed', 'cancelled')
  ),
  tot AS (
    SELECT COUNT(*)::BIGINT AS c FROM active_projects
  ),
  page_data AS (
    SELECT *
      FROM active_projects
     ORDER BY created_at DESC
     LIMIT p_size
    OFFSET p_page * p_size
  )
  SELECT
    pd.id,
    pd.name,
    pd.status::TEXT,
    pd.deadline,
    pd.start_date,
    pd.client_name,
    pd.contract_number,
    pd.budget,
    pd.created_at,
    m.full_name AS manager_name,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'stage_key',     ps2.stage_key,
                'status',        ps2.status::TEXT,
                'deadline',      ps2.deadline,
                'review_status', ps2.review_status::TEXT
              ) ORDER BY ps2.order_index)
         FROM project_stages ps2
        WHERE ps2.project_id = pd.id),
      '[]'::jsonb
    ) AS stages,
    (SELECT c FROM tot) AS total_count
    FROM page_data pd
    LEFT JOIN profiles m ON m.id = pd.manager_id
   ORDER BY pd.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_my_projects_page(UUID, INT, INT) TO authenticated;
