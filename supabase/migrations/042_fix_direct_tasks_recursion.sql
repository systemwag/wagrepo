-- ============================================================
-- Migration 042: fix infinite recursion in direct_tasks RLS
-- ============================================================
-- Симптом: при INSERT/SELECT в direct_tasks Postgres падает с
-- "infinite recursion detected in policy for relation direct_tasks".
--
-- Причина: после миграции 039 политики ссылаются друг на друга:
--   - direct_tasks_select         → EXISTS(direct_task_assignees ...)
--   - direct_task_assignees_select → EXISTS(direct_tasks WHERE created_by=...)
-- При проверке политики на одной таблице вычисляется политика на другой,
-- которая снова обращается к первой → бесконечный цикл.
--
-- Фикс: разрываем цикл через SECURITY DEFINER хелперы, которые выполняются
-- с правами owner'а функции и не запускают RLS повторно.
-- ============================================================

-- ── 1. SECURITY DEFINER хелперы (обходят RLS) ─────────────────────────────

CREATE OR REPLACE FUNCTION is_assignee_of_direct_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM direct_task_assignees
     WHERE task_id    = p_task_id
       AND profile_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION is_creator_of_direct_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM direct_tasks
     WHERE id         = p_task_id
       AND created_by = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION is_assignee_of_direct_task(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_creator_of_direct_task(UUID) TO authenticated;

-- ── 2. Переопределяем политики через хелперы ──────────────────────────────

-- direct_tasks: видеть может создатель, директор+ или назначенный.
DROP POLICY IF EXISTS "direct_tasks_select" ON direct_tasks;
CREATE POLICY "direct_tasks_select" ON direct_tasks
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR has_director_access()
    OR is_assignee_of_direct_task(id)
  );

-- direct_tasks: апдейтить может создатель, директор+ или назначенный.
DROP POLICY IF EXISTS "direct_tasks_update" ON direct_tasks;
CREATE POLICY "direct_tasks_update" ON direct_tasks
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR has_director_access()
    OR is_assignee_of_direct_task(id)
  );

-- direct_task_assignees: видеть может сам assignee, директор+ или создатель задачи.
DROP POLICY IF EXISTS "dtask_assignees_select" ON direct_task_assignees;
CREATE POLICY "dtask_assignees_select" ON direct_task_assignees
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR has_director_access()
    OR is_creator_of_direct_task(task_id)
  );
