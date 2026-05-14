-- ============================================================
-- Migration 026: split tasks → direct_tasks + project_tasks
-- ============================================================
-- Разделение единой таблицы tasks на две сущности:
--   direct_tasks  — прямые поручения (директор → сотрудник),
--                  никаких связей с проектами/этапами.
--   project_tasks — задачи внутри проекта, всегда привязаны к этапу,
--                  опционально к пункту чек-листа.
--
-- ВАЖНО: миграция деструктивная. Применяется один раз на dev-окружении,
-- где данных в tasks нет (либо они тестовые). На prod не применять без
-- предварительной выгрузки и ручной миграции данных.
-- ============================================================

-- ── Шаг 1: снести всё, что зависит от старой tasks ────────────────────────

DROP TRIGGER IF EXISTS notify_task_assignment ON tasks;
DROP TRIGGER IF EXISTS set_updated_at_tasks   ON tasks;

DROP FUNCTION IF EXISTS trigger_notify_task_assignment();
DROP FUNCTION IF EXISTS get_my_task_counts(UUID);
DROP FUNCTION IF EXISTS get_direct_task_counts();
DROP FUNCTION IF EXISTS get_my_overdue_count(UUID);

-- Убрать tasks из realtime-публикации (она вернётся через две новые таблицы)
ALTER PUBLICATION supabase_realtime DROP TABLE tasks;

-- Полный снос старой схемы. task_reports каскадом — потом пересоздадим только для project_tasks.
DROP TABLE IF EXISTS task_reports CASCADE;
DROP TABLE IF EXISTS tasks        CASCADE;

-- Осиротевшие колонки в зависимых таблицах
ALTER TABLE daily_report_tasks DROP COLUMN IF EXISTS task_id;
ALTER TABLE documents          DROP COLUMN IF EXISTS task_id;

-- ── Шаг 2: расширить notification_type ────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'direct_task'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'direct_task';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'project_task'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'project_task';
  END IF;
END $$;

-- ── Шаг 3: direct_tasks ───────────────────────────────────────────────────

CREATE TABLE direct_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  assignee_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        task_status   NOT NULL DEFAULT 'todo',
  priority      task_priority NOT NULL DEFAULT 'medium',
  deadline      DATE,
  employee_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_direct_tasks_assignee_id ON direct_tasks(assignee_id);
CREATE INDEX idx_direct_tasks_created_by  ON direct_tasks(created_by);
CREATE INDEX idx_direct_tasks_status      ON direct_tasks(status);
CREATE INDEX idx_direct_tasks_deadline    ON direct_tasks(deadline) WHERE deadline IS NOT NULL;

ALTER TABLE direct_tasks ENABLE ROW LEVEL SECURITY;

-- Видят: исполнитель, создатель (директор), любой директор
CREATE POLICY "direct_tasks_select" ON direct_tasks FOR SELECT TO authenticated USING (
  assignee_id = auth.uid()
  OR created_by = auth.uid()
  OR get_my_role() = 'director'
);

-- Создаёт только директор
CREATE POLICY "direct_tasks_insert" ON direct_tasks FOR INSERT TO authenticated WITH CHECK (
  get_my_role() = 'director'
);

-- Обновляет: исполнитель (статус/note), создатель, директор
CREATE POLICY "direct_tasks_update" ON direct_tasks FOR UPDATE TO authenticated USING (
  assignee_id = auth.uid()
  OR created_by = auth.uid()
  OR get_my_role() = 'director'
);

-- Удаляет только директор-создатель
CREATE POLICY "direct_tasks_delete" ON direct_tasks FOR DELETE TO authenticated USING (
  get_my_role() = 'director'
);

CREATE TRIGGER set_updated_at_direct_tasks
  BEFORE UPDATE ON direct_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Шаг 4: project_tasks ──────────────────────────────────────────────────

CREATE TABLE project_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id          UUID NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES stage_checklist_items(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  assignee_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status            task_status   NOT NULL DEFAULT 'todo',
  priority          task_priority NOT NULL DEFAULT 'medium',
  deadline          DATE,
  employee_note     TEXT,
  estimated_hours   NUMERIC(6, 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_tasks_project_id  ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_stage_id    ON project_tasks(stage_id);
CREATE INDEX idx_project_tasks_assignee_id ON project_tasks(assignee_id);
CREATE INDEX idx_project_tasks_status      ON project_tasks(status);
CREATE INDEX idx_project_tasks_deadline    ON project_tasks(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX idx_project_tasks_checklist   ON project_tasks(checklist_item_id) WHERE checklist_item_id IS NOT NULL;

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- Проектные задачи видят все (часть проекта)
CREATE POLICY "project_tasks_select" ON project_tasks FOR SELECT USING (TRUE);

-- Создают директор и менеджер
CREATE POLICY "project_tasks_insert" ON project_tasks FOR INSERT TO authenticated WITH CHECK (
  get_my_role() IN ('director', 'manager')
);

-- Обновляют исполнитель и руководители
CREATE POLICY "project_tasks_update" ON project_tasks FOR UPDATE TO authenticated USING (
  get_my_role() IN ('director', 'manager')
  OR assignee_id = auth.uid()
);

-- Удаляют только руководители
CREATE POLICY "project_tasks_delete" ON project_tasks FOR DELETE TO authenticated USING (
  get_my_role() IN ('director', 'manager')
);

CREATE TRIGGER set_updated_at_project_tasks
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Шаг 5: task_reports — отчёты часов по проектным задачам ───────────────

CREATE TABLE task_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  hours_spent     NUMERIC(6, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_reports_project_task ON task_reports(project_task_id);
CREATE INDEX idx_task_reports_author       ON task_reports(author_id);

ALTER TABLE task_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_reports_select" ON task_reports FOR SELECT USING (TRUE);
CREATE POLICY "task_reports_insert" ON task_reports FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "task_reports_update" ON task_reports FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "task_reports_delete" ON task_reports FOR DELETE TO authenticated USING (get_my_role() = 'director');

-- ── Шаг 6: daily_report_tasks — две nullable FK с CHECK ───────────────────

ALTER TABLE daily_report_tasks
  ADD COLUMN direct_task_id  UUID REFERENCES direct_tasks(id)  ON DELETE SET NULL,
  ADD COLUMN project_task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL;

-- Запись в отчёте может ссылаться максимум на одну сторону.
-- Допускается и nil-FK (ручной ввод названия без привязки).
ALTER TABLE daily_report_tasks ADD CONSTRAINT drt_one_kind CHECK (
  NOT (direct_task_id IS NOT NULL AND project_task_id IS NOT NULL)
);

CREATE INDEX idx_drt_direct_task  ON daily_report_tasks(direct_task_id)  WHERE direct_task_id  IS NOT NULL;
CREATE INDEX idx_drt_project_task ON daily_report_tasks(project_task_id) WHERE project_task_id IS NOT NULL;

-- ── Шаг 7: documents.project_task_id (замена старой task_id) ──────────────

ALTER TABLE documents
  ADD COLUMN project_task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE;

CREATE INDEX idx_documents_project_task ON documents(project_task_id) WHERE project_task_id IS NOT NULL;

-- ── Шаг 8: триггеры уведомлений ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_notify_direct_task_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM NEW.created_by THEN
      INSERT INTO notifications (user_id, title, message, type, linked_id)
      VALUES (
        NEW.assignee_id,
        'Новое поручение',
        'Вам выдано поручение: ' || NEW.title,
        'direct_task',
        NEW.id
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assignee_id IS NOT NULL
      AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO notifications (user_id, title, message, type, linked_id)
      VALUES (
        NEW.assignee_id,
        'Новое поручение',
        'Вам перепоручено: ' || NEW.title,
        'direct_task',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_direct_task_assignment
  AFTER INSERT OR UPDATE OF assignee_id ON direct_tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_direct_task_assignment();


CREATE OR REPLACE FUNCTION trigger_notify_project_task_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM NEW.created_by THEN
      INSERT INTO notifications (user_id, title, message, type, linked_id)
      VALUES (
        NEW.assignee_id,
        'Новая задача в проекте',
        'Назначена задача: ' || NEW.title,
        'project_task',
        NEW.project_id   -- linked_id = проект, клик ведёт на канбан проекта
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assignee_id IS NOT NULL
      AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO notifications (user_id, title, message, type, linked_id)
      VALUES (
        NEW.assignee_id,
        'Новая задача в проекте',
        'Перепоручена задача: ' || NEW.title,
        'project_task',
        NEW.project_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_project_task_assignment
  AFTER INSERT OR UPDATE OF assignee_id ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_project_task_assignment();

-- ── Шаг 9: SQL-функции для дашборда ───────────────────────────────────────

-- Счётчики прямых поручений сотрудника по статусу
CREATE OR REPLACE FUNCTION get_my_direct_task_counts(p_user_id UUID)
RETURNS TABLE (status TEXT, "count" INT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT t.status::TEXT, COUNT(*)::INT
    FROM direct_tasks t
   WHERE t.assignee_id = p_user_id
   GROUP BY t.status;
$$;

-- Счётчики проектных задач сотрудника по статусу
CREATE OR REPLACE FUNCTION get_my_project_task_counts(p_user_id UUID)
RETURNS TABLE (status TEXT, "count" INT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT t.status::TEXT, COUNT(*)::INT
    FROM project_tasks t
   WHERE t.assignee_id = p_user_id
   GROUP BY t.status;
$$;

-- Все поручения по статусу (для дашборда директора)
CREATE OR REPLACE FUNCTION get_all_direct_task_counts()
RETURNS TABLE (status TEXT, "count" INT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT t.status::TEXT, COUNT(*)::INT
    FROM direct_tasks t
   GROUP BY t.status;
$$;

-- Просроченные задачи сотрудника — по типу.
-- Возвращает 2 строки: kind='direct'/'project', count=N.
CREATE OR REPLACE FUNCTION get_my_overdue_counts(p_user_id UUID)
RETURNS TABLE (kind TEXT, "count" INT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT 'direct'::TEXT, COUNT(*)::INT FROM direct_tasks
   WHERE assignee_id = p_user_id
     AND status != 'done'
     AND deadline IS NOT NULL
     AND deadline < CURRENT_DATE
  UNION ALL
  SELECT 'project'::TEXT, COUNT(*)::INT FROM project_tasks
   WHERE assignee_id = p_user_id
     AND status != 'done'
     AND deadline IS NOT NULL
     AND deadline < CURRENT_DATE;
$$;

GRANT EXECUTE ON FUNCTION get_my_direct_task_counts(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_project_task_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_direct_task_counts()     TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_overdue_counts(UUID)      TO authenticated;

-- ── Шаг 10: realtime для обеих таблиц ─────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE direct_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE project_tasks;
