-- ============================================================
-- Migration 033: подзадачи в project_tasks
-- ============================================================
-- Добавляет parent_task_id — задача может ссылаться на другую как родителя.
-- Подзадача наследует stage_id родителя (синхронизируется триггерами).
-- При удалении родителя подзадачи каскадно удаляются.
-- ============================================================

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id UUID
    REFERENCES project_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_project_tasks_parent
  ON project_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- ── Синхронизация stage_id ────────────────────────────────────────────────
-- При вставке подзадачи stage_id всегда равен stage_id родителя (если не задан).
-- При смене stage_id родителя — все подзадачи переезжают с ним.
CREATE OR REPLACE FUNCTION sync_subtask_stage_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_parent_stage UUID;
BEGIN
  IF NEW.parent_task_id IS NOT NULL THEN
    SELECT stage_id INTO v_parent_stage FROM project_tasks WHERE id = NEW.parent_task_id;
    IF v_parent_stage IS NOT NULL THEN
      NEW.stage_id := v_parent_stage;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_subtask_stage_on_insert
  BEFORE INSERT ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION sync_subtask_stage_on_insert();

-- При обновлении stage_id родителя — переносим всех детей
CREATE OR REPLACE FUNCTION cascade_stage_to_subtasks()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    UPDATE project_tasks
       SET stage_id = NEW.stage_id
     WHERE parent_task_id = NEW.id
       AND stage_id IS DISTINCT FROM NEW.stage_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cascade_stage_to_subtasks
  AFTER UPDATE OF stage_id ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION cascade_stage_to_subtasks();
