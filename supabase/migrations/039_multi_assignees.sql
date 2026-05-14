-- ============================================================
-- Migration 039: множественные ответственные за этапы и задачи
-- ============================================================
-- Идемпотентная — можно запускать повторно, если часть уже была применена
-- (например, из старой версии файла, когда он назывался 035_multi_assignees).
--
-- Junction-таблицы (many-to-many):
--   project_stage_assignees   — несколько ответственных за этап
--   project_task_assignees    — несколько исполнителей задачи проекта
--   direct_task_assignees     — несколько исполнителей прямого поручения
--
-- Старые колонки assignee_id остаются как legacy: бэкфилятся и держатся
-- синхронизированными триггером (первый ответственный по created_at).
-- ============================================================

-- ─── 1. project_stage_assignees ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_stage_assignees (
  stage_id   UUID NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (stage_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_pstage_assignees_stage   ON project_stage_assignees(stage_id);
CREATE INDEX IF NOT EXISTS idx_pstage_assignees_profile ON project_stage_assignees(profile_id);

ALTER TABLE project_stage_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pstage_assignees_select" ON project_stage_assignees;
DROP POLICY IF EXISTS "pstage_assignees_insert" ON project_stage_assignees;
DROP POLICY IF EXISTS "pstage_assignees_delete" ON project_stage_assignees;
CREATE POLICY "pstage_assignees_select" ON project_stage_assignees FOR SELECT USING (TRUE);
CREATE POLICY "pstage_assignees_insert" ON project_stage_assignees FOR INSERT TO authenticated WITH CHECK (has_manager_access());
CREATE POLICY "pstage_assignees_delete" ON project_stage_assignees FOR DELETE TO authenticated USING (has_manager_access());

-- ─── 2. project_task_assignees ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_task_assignees (
  task_id    UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_ptask_assignees_task    ON project_task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_ptask_assignees_profile ON project_task_assignees(profile_id);

ALTER TABLE project_task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ptask_assignees_select" ON project_task_assignees;
DROP POLICY IF EXISTS "ptask_assignees_insert" ON project_task_assignees;
DROP POLICY IF EXISTS "ptask_assignees_delete" ON project_task_assignees;
CREATE POLICY "ptask_assignees_select" ON project_task_assignees FOR SELECT USING (TRUE);
CREATE POLICY "ptask_assignees_insert" ON project_task_assignees FOR INSERT TO authenticated WITH CHECK (has_manager_access());
CREATE POLICY "ptask_assignees_delete" ON project_task_assignees FOR DELETE TO authenticated USING (has_manager_access());

-- ─── 3. direct_task_assignees ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS direct_task_assignees (
  task_id    UUID NOT NULL REFERENCES direct_tasks(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_dtask_assignees_task    ON direct_task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_dtask_assignees_profile ON direct_task_assignees(profile_id);

ALTER TABLE direct_task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dtask_assignees_select" ON direct_task_assignees;
DROP POLICY IF EXISTS "dtask_assignees_insert" ON direct_task_assignees;
DROP POLICY IF EXISTS "dtask_assignees_delete" ON direct_task_assignees;
CREATE POLICY "dtask_assignees_select" ON direct_task_assignees FOR SELECT TO authenticated USING (
  profile_id = auth.uid()
  OR has_director_access()
  OR EXISTS (SELECT 1 FROM direct_tasks dt WHERE dt.id = direct_task_assignees.task_id AND dt.created_by = auth.uid())
);
CREATE POLICY "dtask_assignees_insert" ON direct_task_assignees FOR INSERT TO authenticated WITH CHECK (has_director_access());
CREATE POLICY "dtask_assignees_delete" ON direct_task_assignees FOR DELETE TO authenticated USING (has_director_access());

-- ─── 4. Бэкфил из текущих assignee_id (идемпотентно через ON CONFLICT) ────
INSERT INTO project_stage_assignees (stage_id, profile_id)
SELECT id, assignee_id FROM project_stages
 WHERE assignee_id IS NOT NULL
 ON CONFLICT DO NOTHING;

INSERT INTO project_task_assignees (task_id, profile_id)
SELECT id, assignee_id FROM project_tasks
 WHERE assignee_id IS NOT NULL
 ON CONFLICT DO NOTHING;

INSERT INTO direct_task_assignees (task_id, profile_id)
SELECT id, assignee_id FROM direct_tasks
 WHERE assignee_id IS NOT NULL
 ON CONFLICT DO NOTHING;

-- ─── 5. Sync triggers: legacy assignee_id = первый по created_at ─────────
CREATE OR REPLACE FUNCTION sync_legacy_project_stage_assignee()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_first UUID;
  v_stage_id UUID := COALESCE(NEW.stage_id, OLD.stage_id);
BEGIN
  SELECT profile_id INTO v_first
    FROM project_stage_assignees
   WHERE stage_id = v_stage_id
   ORDER BY created_at, profile_id
   LIMIT 1;
  UPDATE project_stages SET assignee_id = v_first WHERE id = v_stage_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_legacy_pstage_assignee ON project_stage_assignees;
CREATE TRIGGER sync_legacy_pstage_assignee
  AFTER INSERT OR DELETE ON project_stage_assignees
  FOR EACH ROW EXECUTE FUNCTION sync_legacy_project_stage_assignee();


CREATE OR REPLACE FUNCTION sync_legacy_project_task_assignee()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_first UUID;
  v_task_id UUID := COALESCE(NEW.task_id, OLD.task_id);
BEGIN
  SELECT profile_id INTO v_first
    FROM project_task_assignees
   WHERE task_id = v_task_id
   ORDER BY created_at, profile_id
   LIMIT 1;
  UPDATE project_tasks SET assignee_id = v_first WHERE id = v_task_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_legacy_ptask_assignee ON project_task_assignees;
CREATE TRIGGER sync_legacy_ptask_assignee
  AFTER INSERT OR DELETE ON project_task_assignees
  FOR EACH ROW EXECUTE FUNCTION sync_legacy_project_task_assignee();


CREATE OR REPLACE FUNCTION sync_legacy_direct_task_assignee()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_first UUID;
  v_task_id UUID := COALESCE(NEW.task_id, OLD.task_id);
BEGIN
  SELECT profile_id INTO v_first
    FROM direct_task_assignees
   WHERE task_id = v_task_id
   ORDER BY created_at, profile_id
   LIMIT 1;
  UPDATE direct_tasks SET assignee_id = v_first WHERE id = v_task_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_legacy_dtask_assignee ON direct_task_assignees;
CREATE TRIGGER sync_legacy_dtask_assignee
  AFTER INSERT OR DELETE ON direct_task_assignees
  FOR EACH ROW EXECUTE FUNCTION sync_legacy_direct_task_assignee();


-- ─── 6. Notifications: переключение со старых триггеров на junction ──────
-- Дропаем старые (если ещё живы), потом ставим новые на junction.
DROP TRIGGER IF EXISTS notify_project_task_assignment ON project_tasks;
DROP TRIGGER IF EXISTS notify_direct_task_assignment ON direct_tasks;

CREATE OR REPLACE FUNCTION notify_new_project_task_assignee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_title TEXT;
  v_project_id UUID;
  v_created_by UUID;
BEGIN
  SELECT title, project_id, created_by
    INTO v_title, v_project_id, v_created_by
    FROM project_tasks WHERE id = NEW.task_id;

  IF NEW.profile_id IS DISTINCT FROM v_created_by THEN
    INSERT INTO notifications (user_id, title, message, type, linked_id)
    VALUES (
      NEW.profile_id,
      'Новая задача в проекте',
      'Назначена задача: ' || v_title,
      'project_task',
      v_project_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_project_task_assignee ON project_task_assignees;
CREATE TRIGGER notify_new_project_task_assignee
  AFTER INSERT ON project_task_assignees
  FOR EACH ROW EXECUTE FUNCTION notify_new_project_task_assignee();


CREATE OR REPLACE FUNCTION notify_new_direct_task_assignee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_title TEXT;
  v_created_by UUID;
BEGIN
  SELECT title, created_by INTO v_title, v_created_by
    FROM direct_tasks WHERE id = NEW.task_id;

  IF NEW.profile_id IS DISTINCT FROM v_created_by THEN
    INSERT INTO notifications (user_id, title, message, type, linked_id)
    VALUES (
      NEW.profile_id,
      'Новое поручение',
      'Вам выдано поручение: ' || v_title,
      'direct_task',
      NEW.task_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_direct_task_assignee ON direct_task_assignees;
CREATE TRIGGER notify_new_direct_task_assignee
  AFTER INSERT ON direct_task_assignees
  FOR EACH ROW EXECUTE FUNCTION notify_new_direct_task_assignee();


-- ─── 7. RLS: разрешить любому ассигни видеть/обновлять свои задачи ───────
DROP POLICY IF EXISTS "project_tasks_update" ON project_tasks;
CREATE POLICY "project_tasks_update" ON project_tasks FOR UPDATE TO authenticated USING (
  has_manager_access()
  OR EXISTS (
    SELECT 1 FROM project_task_assignees
     WHERE task_id = project_tasks.id AND profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "direct_tasks_select" ON direct_tasks;
CREATE POLICY "direct_tasks_select" ON direct_tasks FOR SELECT TO authenticated USING (
  created_by = auth.uid()
  OR has_director_access()
  OR EXISTS (
    SELECT 1 FROM direct_task_assignees
     WHERE task_id = direct_tasks.id AND profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "direct_tasks_update" ON direct_tasks;
CREATE POLICY "direct_tasks_update" ON direct_tasks FOR UPDATE TO authenticated USING (
  created_by = auth.uid()
  OR has_director_access()
  OR EXISTS (
    SELECT 1 FROM direct_task_assignees
     WHERE task_id = direct_tasks.id AND profile_id = auth.uid()
  )
);
