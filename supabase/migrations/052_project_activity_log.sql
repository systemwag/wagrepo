-- ============================================================
-- Migration 052: журнал прогресса по проекту
-- ============================================================
-- 1. Расширяем RLS на activity_log: события с entity_type ∈
--    ('project','stage','project_task') — видны всем authenticated.
--    Это нужно для вкладки «Прогресс» на странице проекта.
--    Чувствительные события (direct_task, event, notifications) —
--    как раньше, только director + автор.
--
-- 2. RPC get_project_activity(uuid, int, int) — собирает все
--    события проекта одним запросом с join к profiles для имени актёра.
--    SECURITY INVOKER — полагаемся на RLS.
-- ============================================================

-- ── 1. RLS на activity_log ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "activity_log_select" ON activity_log;
CREATE POLICY "activity_log_select" ON activity_log
  FOR SELECT TO authenticated
  USING (
    has_director_access()
    OR actor_id = auth.uid()
    OR entity_type IN ('project', 'stage', 'project_task')
  );


-- ── 2. RPC get_project_activity ────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_project_activity(UUID, INT, INT);
CREATE OR REPLACE FUNCTION get_project_activity(
  p_project_id UUID,
  p_limit      INT DEFAULT 50,
  p_offset     INT DEFAULT 0
)
RETURNS TABLE (
  id          UUID,
  actor_id    UUID,
  actor_name  TEXT,
  entity_type TEXT,
  entity_id   UUID,
  action      TEXT,
  meta        JSONB,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    al.id,
    al.actor_id,
    p.full_name AS actor_name,
    al.entity_type,
    al.entity_id,
    al.action,
    al.meta,
    al.created_at
  FROM activity_log al
  LEFT JOIN profiles p ON p.id = al.actor_id
  WHERE
    (al.entity_type = 'project'      AND al.entity_id = p_project_id)
    OR (al.entity_type = 'stage'        AND al.entity_id IN (SELECT id FROM project_stages WHERE project_id = p_project_id))
    OR (al.entity_type = 'project_task' AND al.entity_id IN (SELECT id FROM project_tasks  WHERE project_id = p_project_id))
  ORDER BY al.created_at DESC
  LIMIT p_limit OFFSET p_offset
$$;

GRANT EXECUTE ON FUNCTION get_project_activity(UUID, INT, INT) TO authenticated;
