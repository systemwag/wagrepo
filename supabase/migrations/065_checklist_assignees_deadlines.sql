-- ============================================================
-- Migration 065: ответственные и дедлайн на пункт чек-листа
-- ============================================================
-- Добавляет:
--   1. Колонки deadline / assigned_at / started_at / started_by
--      на stage_checklist_items — жизненный цикл пункта.
--   2. Junction stage_checklist_item_assignees — мульти-ассигни.
--   3. Helper can_manage_stage_checklist() — реюз в нескольких политиках.
--   4. Обновлённую RLS на stage_checklist_items.UPDATE: дополнительно
--      разрешает junction-ассигни этапа и ассигни самого пункта.
--   5. Триггеры: notify_new_checklist_assignee, set_checklist_assigned_at.
--   6. Расширение RPC get_employee_project_view — пункт чек-листа с моим
--      assignee открывает видимость этапа.
--
-- Идемпотентна (CREATE TABLE/COLUMN/POLICY IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================

-- ─── 1. Колонки жизненного цикла на пункте ─────────────────────────────────
ALTER TABLE stage_checklist_items
  ADD COLUMN IF NOT EXISTS deadline    DATE,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_by  UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_items_deadline
  ON stage_checklist_items(deadline)
  WHERE deadline IS NOT NULL AND is_completed = FALSE;

-- ─── 2. Junction stage_checklist_item_assignees ────────────────────────────
CREATE TABLE IF NOT EXISTS stage_checklist_item_assignees (
  item_id    UUID NOT NULL REFERENCES stage_checklist_items(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_assignees_item
  ON stage_checklist_item_assignees(item_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assignees_profile
  ON stage_checklist_item_assignees(profile_id);

ALTER TABLE stage_checklist_item_assignees ENABLE ROW LEVEL SECURITY;

-- ─── 3. Helper: кто может управлять чек-листом этапа ───────────────────────
-- director/manager/admin ИЛИ ответственный за этап (legacy assignee_id или
-- junction project_stage_assignees) ИЛИ менеджер проекта.
CREATE OR REPLACE FUNCTION can_manage_stage_checklist(p_stage_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_manager_access()
    OR EXISTS (
      SELECT 1
        FROM project_stages ps
        LEFT JOIN projects p ON p.id = ps.project_id
       WHERE ps.id = p_stage_id
         AND (ps.assignee_id = auth.uid() OR p.manager_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
        FROM project_stage_assignees psa
       WHERE psa.stage_id = p_stage_id
         AND psa.profile_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION can_manage_stage_checklist(UUID) TO authenticated;

-- ─── 4. RLS на junction ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "checklist_assignees_select" ON stage_checklist_item_assignees;
DROP POLICY IF EXISTS "checklist_assignees_insert" ON stage_checklist_item_assignees;
DROP POLICY IF EXISTS "checklist_assignees_delete" ON stage_checklist_item_assignees;

CREATE POLICY "checklist_assignees_select" ON stage_checklist_item_assignees
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "checklist_assignees_insert" ON stage_checklist_item_assignees
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stage_checklist_items i
       WHERE i.id = stage_checklist_item_assignees.item_id
         AND can_manage_stage_checklist(i.stage_id)
    )
  );

CREATE POLICY "checklist_assignees_delete" ON stage_checklist_item_assignees
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stage_checklist_items i
       WHERE i.id = stage_checklist_item_assignees.item_id
         AND can_manage_stage_checklist(i.stage_id)
    )
  );

-- ─── 5. Расширить RLS на stage_checklist_items.UPDATE ──────────────────────
-- Право обновлять пункт (отмечать выполненным, ставить started_at, менять
-- deadline) получают:
--   - те, кто может управлять чек-листом этапа (см. хелпер выше),
--   - ассигни самого пункта (через junction).
DROP POLICY IF EXISTS "checklist_update" ON stage_checklist_items;
CREATE POLICY "checklist_update" ON stage_checklist_items
  FOR UPDATE TO authenticated
  USING (
    can_manage_stage_checklist(stage_id)
    OR EXISTS (
      SELECT 1
        FROM stage_checklist_item_assignees a
       WHERE a.item_id = stage_checklist_items.id
         AND a.profile_id = auth.uid()
    )
  );

-- ─── 6. Триггер: первый assignee ставит assigned_at ────────────────────────
CREATE OR REPLACE FUNCTION set_checklist_assigned_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE stage_checklist_items
     SET assigned_at = NOW()
   WHERE id = NEW.item_id
     AND assigned_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_checklist_assigned_at ON stage_checklist_item_assignees;
CREATE TRIGGER set_checklist_assigned_at
  AFTER INSERT ON stage_checklist_item_assignees
  FOR EACH ROW EXECUTE FUNCTION set_checklist_assigned_at();

-- ─── 7. Триггер: уведомление новому ассигни ────────────────────────────────
-- Тип уведомления = 'project' (переиспользуем существующий enum, чтобы не
-- плодить ALTER TYPE; UI и так роутит project на страницу проекта).
CREATE OR REPLACE FUNCTION notify_new_checklist_assignee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_label        TEXT;
  v_project_id   UUID;
  v_project_name TEXT;
BEGIN
  -- Сам себя не уведомляем (менеджер назначил себя в свой же чек-лист).
  IF NEW.profile_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  SELECT i.label, ps.project_id, p.name
    INTO v_label, v_project_id, v_project_name
    FROM stage_checklist_items i
    JOIN project_stages ps ON ps.id = i.stage_id
    JOIN projects p ON p.id = ps.project_id
   WHERE i.id = NEW.item_id;

  IF v_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, title, message, type, linked_id)
  VALUES (
    NEW.profile_id,
    'Вы назначены в чек-листе',
    v_project_name || ' · ' || v_label,
    'project',
    v_project_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_checklist_assignee ON stage_checklist_item_assignees;
CREATE TRIGGER notify_new_checklist_assignee
  AFTER INSERT ON stage_checklist_item_assignees
  FOR EACH ROW EXECUTE FUNCTION notify_new_checklist_assignee();

-- ─── 8. RPC get_employee_project_view: пункт чек-листа открывает этап ──────
-- Пересоздаём целиком (миграция 059) — добавляется UNION-ветка по пунктам,
-- где у сотрудника есть assignee.
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
      -- этап, где я ответственный (legacy)
      SELECT ps.id
        FROM project_stages ps
       WHERE ps.project_id = p_project_id
         AND ps.assignee_id = v_user_id
      UNION
      -- этап, где я в junction-ассигнах
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
      UNION
      -- этап, где у меня есть assignee на пункт чек-листа (миграция 065)
      SELECT i.stage_id
        FROM stage_checklist_item_assignees a
        JOIN stage_checklist_items i ON i.id = a.item_id
        JOIN project_stages ps3 ON ps3.id = i.stage_id
       WHERE ps3.project_id = p_project_id
         AND a.profile_id = v_user_id
    )
  SELECT
    COALESCE((SELECT array_agg(id) FROM my_stage_ids), ARRAY[]::UUID[]),
    COALESCE((SELECT array_agg(id) FROM my_task_ids),  ARRAY[]::UUID[]);
END;
$$;

GRANT EXECUTE ON FUNCTION get_employee_project_view(UUID, UUID) TO authenticated;
