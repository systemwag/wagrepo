-- ============================================================
-- Migration 045: автосинхронизация legacy assignee_id → junction
-- ============================================================
-- Симптом (обнаружен 2026-05-18 на dev): директор создаёт прямое
-- поручение через UI — оно появляется в `direct_tasks`, директор его
-- видит в журнале и в своём handover-блоке «Переданные вам», но
-- сотрудник-получатель НЕ видит его ни на `/dashboard/assignments`,
-- ни на `/dashboard/handover`, и не получает push-уведомление.
--
-- Причина: миграция 039_multi_assignees переключила RLS-политики и
-- триггер уведомлений на junction-таблицы:
--   - direct_tasks_select         → EXISTS(direct_task_assignees ...)
--   - notify_new_direct_task_assignee — на INSERT в direct_task_assignees
--   - project_tasks_update        → EXISTS(project_task_assignees ...)
-- Однако Server Actions createDirectTask / createDirectTaskBulk /
-- createProjectTask продолжают писать ТОЛЬКО в legacy-колонку
-- assignee_id. В junction для новых строк остаётся пусто, поэтому:
--   - RLS не пускает исполнителя на SELECT/UPDATE
--   - триггер уведомлений не срабатывает (он на INSERT junction)
-- Bulk-backfill из 039 покрыл только данные, существовавшие на момент
-- применения миграции. Всё, что создано после, — невидимо.
--
-- Решение: один общий триггер на каждой из трёх «несущих» таблиц,
-- который зеркалирует assignee_id → junction (INSERT при появлении,
-- DELETE+INSERT при смене, DELETE при NULL). После этого Server
-- Actions не нужно трогать — синхронизация прозрачна.
--
-- Безопасность от циклов:
--   - функции SECURITY DEFINER + INSERT ON CONFLICT DO NOTHING:
--     если junction уже содержит запись, INSERT не приводит к реальной
--     модификации, AFTER INSERT-trigger на junction не срабатывает.
--   - sync_legacy_* триггеры из 039 при срабатывании делают UPDATE
--     с тем же assignee_id → новый триггер пропускает через WHEN
--     (NEW.assignee_id IS DISTINCT FROM OLD.assignee_id).
-- ============================================================


-- ── 0. Бэкфил: вставить недостающие записи в junction для всего, что
--       было создано после миграции 039.
-- Идемпотентно: ON CONFLICT DO NOTHING.
INSERT INTO direct_task_assignees (task_id, profile_id)
SELECT id, assignee_id FROM direct_tasks
 WHERE assignee_id IS NOT NULL
 ON CONFLICT DO NOTHING;

INSERT INTO project_task_assignees (task_id, profile_id)
SELECT id, assignee_id FROM project_tasks
 WHERE assignee_id IS NOT NULL
 ON CONFLICT DO NOTHING;

INSERT INTO project_stage_assignees (stage_id, profile_id)
SELECT id, assignee_id FROM project_stages
 WHERE assignee_id IS NOT NULL
 ON CONFLICT DO NOTHING;


-- ── 1. direct_tasks: assignee_id → direct_task_assignees ──────────────────
CREATE OR REPLACE FUNCTION sync_assignee_to_direct_task_junction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL THEN
      INSERT INTO direct_task_assignees (task_id, profile_id)
      VALUES (NEW.id, NEW.assignee_id)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Снимаем старого, если был и сменился
    IF OLD.assignee_id IS NOT NULL
       AND OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
      DELETE FROM direct_task_assignees
       WHERE task_id = NEW.id AND profile_id = OLD.assignee_id;
    END IF;
    -- Добавляем нового, если задан и изменился
    IF NEW.assignee_id IS NOT NULL
       AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO direct_task_assignees (task_id, profile_id)
      VALUES (NEW.id, NEW.assignee_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_assignee_to_direct_junction ON direct_tasks;
CREATE TRIGGER sync_assignee_to_direct_junction
  AFTER INSERT OR UPDATE OF assignee_id ON direct_tasks
  FOR EACH ROW EXECUTE FUNCTION sync_assignee_to_direct_task_junction();


-- ── 2. project_tasks: assignee_id → project_task_assignees ────────────────
CREATE OR REPLACE FUNCTION sync_assignee_to_project_task_junction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL THEN
      INSERT INTO project_task_assignees (task_id, profile_id)
      VALUES (NEW.id, NEW.assignee_id)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.assignee_id IS NOT NULL
       AND OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
      DELETE FROM project_task_assignees
       WHERE task_id = NEW.id AND profile_id = OLD.assignee_id;
    END IF;
    IF NEW.assignee_id IS NOT NULL
       AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO project_task_assignees (task_id, profile_id)
      VALUES (NEW.id, NEW.assignee_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_assignee_to_project_task_junction ON project_tasks;
CREATE TRIGGER sync_assignee_to_project_task_junction
  AFTER INSERT OR UPDATE OF assignee_id ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION sync_assignee_to_project_task_junction();


-- ── 3. project_stages: assignee_id → project_stage_assignees ──────────────
CREATE OR REPLACE FUNCTION sync_assignee_to_project_stage_junction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL THEN
      INSERT INTO project_stage_assignees (stage_id, profile_id)
      VALUES (NEW.id, NEW.assignee_id)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.assignee_id IS NOT NULL
       AND OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
      DELETE FROM project_stage_assignees
       WHERE stage_id = NEW.id AND profile_id = OLD.assignee_id;
    END IF;
    IF NEW.assignee_id IS NOT NULL
       AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO project_stage_assignees (stage_id, profile_id)
      VALUES (NEW.id, NEW.assignee_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_assignee_to_project_stage_junction ON project_stages;
CREATE TRIGGER sync_assignee_to_project_stage_junction
  AFTER INSERT OR UPDATE OF assignee_id ON project_stages
  FOR EACH ROW EXECUTE FUNCTION sync_assignee_to_project_stage_junction();
