-- ==========================================================
-- 012_fix_notifications_rls.sql
-- Триггерные функции должны выполняться с правами владельца
-- (SECURITY DEFINER), иначе RLS блокирует INSERT в notifications.
-- ==========================================================

-- Пересоздаём функции с SECURITY DEFINER

CREATE OR REPLACE FUNCTION trigger_notify_new_project()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION trigger_notify_task_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
    IF NEW.assignee_id IS NOT NULL
      AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
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
