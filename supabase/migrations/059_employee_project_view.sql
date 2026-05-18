-- ============================================================
-- Migration 059: видимость проекта для сотрудника
-- ============================================================
-- Сотрудник на странице проекта должен видеть только то, что
-- его касается:
--   - этапы, где он назначен ответственным (legacy assignee_id
--     или через junction project_stage_assignees);
--   - этапы, в которых у него есть задача (даже если за этап
--     отвечает не он — это его рабочий контекст);
--   - задачи, назначенные ему (через assignee_id или junction
--     project_task_assignees).
--
-- RPC возвращает один row с двумя массивами UUID — клиент в
-- page.tsx применяет их как фильтр к уже загруженным stages/tasks.
--
-- SECURITY DEFINER + guard: вызвать функцию для чужого user_id
-- может только director/admin. Иначе подставляем auth.uid().
-- ============================================================

DROP FUNCTION IF EXISTS get_employee_project_view(UUID, UUID);
CREATE OR REPLACE FUNCTION get_employee_project_view(
  p_project_id UUID,
  p_user_id    UUID
)
RETURNS TABLE (
  visible_stage_ids UUID[],
  visible_task_ids  UUID[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Guard: чужой user_id видит только director/admin. Обычный сотрудник,
  -- даже если попытается передать чужой UUID, получит данные своего view.
  IF p_user_id <> auth.uid() AND NOT has_director_access() THEN
    v_user_id := auth.uid();
  ELSE
    v_user_id := COALESCE(p_user_id, auth.uid());
  END IF;

  RETURN QUERY
  WITH
    my_task_ids AS (
      SELECT pt.id
        FROM project_tasks pt
       WHERE pt.project_id = p_project_id
         AND (
           pt.assignee_id = v_user_id
           OR EXISTS (
             SELECT 1 FROM project_task_assignees pta
              WHERE pta.task_id = pt.id AND pta.profile_id = v_user_id
           )
         )
    ),
    my_stage_ids AS (
      -- этап где я ответственный (legacy)
      SELECT ps.id
        FROM project_stages ps
       WHERE ps.project_id = p_project_id
         AND ps.assignee_id = v_user_id
      UNION
      -- этап где я в junction-ассигнах
      SELECT psa.stage_id
        FROM project_stage_assignees psa
        JOIN project_stages ps2 ON ps2.id = psa.stage_id
       WHERE ps2.project_id = p_project_id
         AND psa.profile_id = v_user_id
      UNION
      -- этап, где у меня есть задача
      SELECT pt.stage_id
        FROM project_tasks pt
       WHERE pt.project_id = p_project_id
         AND pt.stage_id IS NOT NULL
         AND pt.id IN (SELECT id FROM my_task_ids)
    )
  SELECT
    COALESCE((SELECT array_agg(id) FROM my_stage_ids), ARRAY[]::UUID[]),
    COALESCE((SELECT array_agg(id) FROM my_task_ids),  ARRAY[]::UUID[]);
END;
$$;

GRANT EXECUTE ON FUNCTION get_employee_project_view(UUID, UUID) TO authenticated;
