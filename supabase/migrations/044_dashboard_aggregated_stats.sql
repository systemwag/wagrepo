-- ============================================================
-- Migration 044: агрегированные RPC для счётчиков дашборда
-- ============================================================
-- Цель: уменьшить число round-trip'ов от Next.js к Supabase.
-- Дашборд каждого пользователя сейчас делает 3 отдельных запроса
-- для верхней строки счётчиков:
--   Director: projects-count + profiles-count + get_all_direct_task_counts
--   Manager:  my-projects-count + my-project-task-counts + my-direct-task-counts
--   Employee: my-project-task-counts + my-overdue-counts (3 в сумме)
--
-- Эта миграция добавляет по одной RPC на роль, которая возвращает
-- все нужные счётчики одним вызовом → 1 RTT вместо 3.
--
-- Старые функции (get_all_direct_task_counts, get_my_*) остаются —
-- ими пользуются другие места кода, не ломаем совместимость.
--
-- Безопасность: следуем паттерну миграции 043 — role-guard в начале,
-- SECURITY DEFINER, SET search_path = public.
-- ============================================================


-- ── 1. DIRECTOR ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_director_dashboard_stats()
RETURNS TABLE (
  projects_count     INT,
  employees_count    INT,
  direct_task_counts JSONB  -- {"todo": N, "in_progress": M, "review": K, "done": L}
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_director_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM projects WHERE status = 'active'),
    (SELECT COUNT(*)::INT FROM profiles WHERE is_active = TRUE),
    COALESCE(
      (SELECT jsonb_object_agg(status::TEXT, c)
         FROM (
           SELECT status, COUNT(*)::INT AS c
             FROM direct_tasks
            GROUP BY status
         ) sub),
      '{}'::jsonb
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_director_dashboard_stats() TO authenticated;


-- ── 2. MANAGER ──────────────────────────────────────────────────────────────
-- Возвращает: число активных проектов, где я менеджер + счётчики моих
-- проектных задач + счётчики моих поручений.
CREATE OR REPLACE FUNCTION get_manager_dashboard_stats(p_user_id UUID)
RETURNS TABLE (
  my_projects_count   INT,
  project_task_counts JSONB,
  direct_task_counts  JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT has_director_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM projects
       WHERE manager_id = p_user_id AND status = 'active'),
    COALESCE(
      (SELECT jsonb_object_agg(status::TEXT, c)
         FROM (
           SELECT status, COUNT(*)::INT AS c
             FROM project_tasks
            WHERE assignee_id = p_user_id
            GROUP BY status
         ) sub),
      '{}'::jsonb
    ),
    COALESCE(
      (SELECT jsonb_object_agg(status::TEXT, c)
         FROM (
           SELECT status, COUNT(*)::INT AS c
             FROM direct_tasks
            WHERE assignee_id = p_user_id
            GROUP BY status
         ) sub),
      '{}'::jsonb
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_manager_dashboard_stats(UUID) TO authenticated;


-- ── 3. EMPLOYEE ─────────────────────────────────────────────────────────────
-- Возвращает: счётчики моих проектных задач + раздельные счётчики просрочек
-- (direct / project).
CREATE OR REPLACE FUNCTION get_employee_dashboard_stats(p_user_id UUID)
RETURNS TABLE (
  project_task_counts JSONB,
  overdue_direct      INT,
  overdue_project     INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT has_director_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    COALESCE(
      (SELECT jsonb_object_agg(status::TEXT, c)
         FROM (
           SELECT status, COUNT(*)::INT AS c
             FROM project_tasks
            WHERE assignee_id = p_user_id
            GROUP BY status
         ) sub),
      '{}'::jsonb
    ),
    (SELECT COUNT(*)::INT FROM direct_tasks
       WHERE assignee_id = p_user_id
         AND status != 'done'
         AND deadline IS NOT NULL
         AND deadline < CURRENT_DATE),
    (SELECT COUNT(*)::INT FROM project_tasks
       WHERE assignee_id = p_user_id
         AND status != 'done'
         AND deadline IS NOT NULL
         AND deadline < CURRENT_DATE);
END;
$$;

GRANT EXECUTE ON FUNCTION get_employee_dashboard_stats(UUID) TO authenticated;
