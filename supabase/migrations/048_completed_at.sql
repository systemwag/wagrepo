-- ============================================================
-- Migration 048: фиксация времени выполнения задачи
-- ============================================================
-- Парная к 046: accepted_at говорит «когда взял в работу»,
-- completed_at — «когда отметил выполненным».
--
-- Поведение:
--   - переход на 'done' → NOW()
--   - возврат с 'done' (директор отправил на доработку, статус ушёл
--     в review/in_progress/todo) → NULL, потому что задача больше
--     не находится в выполненном состоянии.
--
-- Бэкфил для существующих 'done': берём время последнего перехода
-- на 'done' из activity_log (миграция 032 пишет
-- *.status_changed_audit с meta.to_status). Если audit-записи нет —
-- completed_at остаётся NULL, UI просто не показывает время.
-- ============================================================

-- ── 1. direct_tasks ────────────────────────────────────────────────────────
ALTER TABLE direct_tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION sync_direct_task_completed_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at := NOW();
  ELSIF NEW.status IS DISTINCT FROM 'done' AND OLD.status = 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_direct_task_completed_at ON direct_tasks;
CREATE TRIGGER sync_direct_task_completed_at
  BEFORE UPDATE OF status ON direct_tasks
  FOR EACH ROW EXECUTE FUNCTION sync_direct_task_completed_at();


-- ── 2. project_tasks ───────────────────────────────────────────────────────
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION sync_project_task_completed_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at := NOW();
  ELSIF NEW.status IS DISTINCT FROM 'done' AND OLD.status = 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_project_task_completed_at ON project_tasks;
CREATE TRIGGER sync_project_task_completed_at
  BEFORE UPDATE OF status ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION sync_project_task_completed_at();


-- ── 3. Бэкфил из activity_log ──────────────────────────────────────────────
UPDATE direct_tasks dt
   SET completed_at = sub.last_done
  FROM (
    SELECT entity_id, MAX(created_at) AS last_done
      FROM activity_log
     WHERE entity_type = 'direct_task'
       AND action = 'direct_task.status_changed_audit'
       AND meta->>'to_status' = 'done'
     GROUP BY entity_id
  ) sub
 WHERE dt.id = sub.entity_id
   AND dt.completed_at IS NULL
   AND dt.status = 'done';

UPDATE project_tasks pt
   SET completed_at = sub.last_done
  FROM (
    SELECT entity_id, MAX(created_at) AS last_done
      FROM activity_log
     WHERE entity_type = 'project_task'
       AND action = 'project_task.status_changed_audit'
       AND meta->>'to_status' = 'done'
     GROUP BY entity_id
  ) sub
 WHERE pt.id = sub.entity_id
   AND pt.completed_at IS NULL
   AND pt.status = 'done';
