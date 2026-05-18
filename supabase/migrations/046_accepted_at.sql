-- ============================================================
-- Migration 046: фиксация времени принятия задачи в работу
-- ============================================================
-- Бизнес-запрос: директор хочет видеть, когда сотрудник реально
-- взял задачу/поручение в работу (status: todo → in_progress).
-- Раньше это было видно только косвенно через activity_log.
--
-- Подход: новая колонка `accepted_at` + триггер, который её
-- проставляет автоматически на любом переходе `→ in_progress` и
-- сбрасывает на переходе `→ todo` (откат после rejectHandover).
-- Никаких изменений в Server Actions не нужно — handover.ts
-- продолжает делать просто `update({ status: 'in_progress' })`,
-- триггер дописывает timestamp.
-- ============================================================

-- ── 1. direct_tasks ────────────────────────────────────────────────────────
ALTER TABLE direct_tasks
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION sync_direct_task_accepted_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Принятие в работу: проставляем (или обновляем при повторном принятии).
  IF NEW.status = 'in_progress'
     AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    NEW.accepted_at := NOW();
  -- Возврат в очередь (rejectHandover): обнуляем, чтобы UI не показывал
  -- устаревшее время принятия для непринятой задачи.
  ELSIF NEW.status = 'todo'
        AND OLD.status IS DISTINCT FROM 'todo' THEN
    NEW.accepted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_direct_task_accepted_at ON direct_tasks;
CREATE TRIGGER sync_direct_task_accepted_at
  BEFORE UPDATE OF status ON direct_tasks
  FOR EACH ROW EXECUTE FUNCTION sync_direct_task_accepted_at();


-- ── 2. project_tasks ───────────────────────────────────────────────────────
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION sync_project_task_accepted_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'in_progress'
     AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    NEW.accepted_at := NOW();
  ELSIF NEW.status = 'todo'
        AND OLD.status IS DISTINCT FROM 'todo' THEN
    NEW.accepted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_project_task_accepted_at ON project_tasks;
CREATE TRIGGER sync_project_task_accepted_at
  BEFORE UPDATE OF status ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION sync_project_task_accepted_at();


-- ── 3. Бэкфил из activity_log ──────────────────────────────────────────────
-- handover.ts пишет action='direct_task.accepted' / 'project_task.accepted'
-- (см. миграцию 032 ставит ещё *.status_changed_audit). Бэкфил берёт самую
-- РАННЮЮ запись о принятии — это и есть момент первого взятия в работу.
-- Если задача потом откатывалась — последняя смена статуса перепишет всё
-- равно через триггер при следующем UPDATE; одноразовый бэкфил это ок.
UPDATE direct_tasks dt
   SET accepted_at = sub.first_accepted
  FROM (
    SELECT entity_id, MIN(created_at) AS first_accepted
      FROM activity_log
     WHERE entity_type = 'direct_task'
       AND action = 'direct_task.accepted'
     GROUP BY entity_id
  ) sub
 WHERE dt.id = sub.entity_id
   AND dt.accepted_at IS NULL
   AND dt.status IN ('in_progress', 'review', 'done');

UPDATE project_tasks pt
   SET accepted_at = sub.first_accepted
  FROM (
    SELECT entity_id, MIN(created_at) AS first_accepted
      FROM activity_log
     WHERE entity_type = 'project_task'
       AND action = 'project_task.accepted'
     GROUP BY entity_id
  ) sub
 WHERE pt.id = sub.entity_id
   AND pt.accepted_at IS NULL
   AND pt.status IN ('in_progress', 'review', 'done');
