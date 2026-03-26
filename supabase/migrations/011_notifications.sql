-- ==========================================================
-- 011_notifications.sql — Модуль уведомлений
-- ==========================================================

CREATE TYPE notification_type AS ENUM ('project', 'task', 'system');

CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type notification_type NOT NULL DEFAULT 'system',
  linked_id uuid, -- ID связанного проекта или задачи (не строгий foreign key для гибкости)
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Включить realtime для уведомлений
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ==========================================================
-- Триггер: Уведомление при новом проекте
-- ==========================================================
CREATE OR REPLACE FUNCTION trigger_notify_new_project()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Отправлять если назначен менеджер, который не является создателем
  IF NEW.manager_id IS NOT NULL AND NEW.manager_id != NEW.created_by THEN
    INSERT INTO notifications (user_id, title, message, type, linked_id)
    VALUES (
      NEW.manager_id,
      'Новый проект',
      'Вы назначены менеджером проекта «' || NEW.name || '»',
      'project',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_project ON projects;
CREATE TRIGGER notify_new_project
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_new_project();

-- ==========================================================
-- Триггер: Уведомление о новой задаче / смене ответственного
-- ==========================================================
CREATE OR REPLACE FUNCTION trigger_notify_task_assignment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id != NEW.created_by THEN
      INSERT INTO notifications (user_id, title, message, type, linked_id)
      VALUES (
        NEW.assignee_id,
        'Новая задача',
        'Вам назначена новая задача: ' || NEW.title,
        'task',
        NEW.id
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Изменился ответственный
    IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id AND NEW.assignee_id != auth.uid() THEN
      INSERT INTO notifications (user_id, title, message, type, linked_id)
      VALUES (
        NEW.assignee_id,
        'Новая задача',
        'Вам поручена задача: ' || NEW.title,
        'task',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_task_assignment ON tasks;
CREATE TRIGGER notify_task_assignment
  AFTER INSERT OR UPDATE OF assignee_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_task_assignment();
