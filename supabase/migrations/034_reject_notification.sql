-- ============================================================
-- Migration 030: уведомление создателю при отклонении задачи/поручения
-- ============================================================
-- Когда исполнитель отклоняет (assignee_id → NULL) на direct_tasks или
-- project_tasks, создатель должен получить notification.
--
-- Логика «reject»: assignee_id был NOT NULL → стал NULL, status='todo',
-- employee_note содержит причину начиная с '[Отклонено]'.
--
-- В server action `rejectHandover()` мы уже пишем INSERT в notifications
-- напрямую — это работает. Но добавляем DB-trigger как страховку: даже если
-- кто-то снимет assignee через прямой SQL/Supabase Dashboard, уведомление
-- придёт.
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_notify_direct_task_rejected()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.assignee_id IS NOT NULL
    AND NEW.assignee_id IS NULL
    AND NEW.created_by IS NOT NULL
    AND NEW.created_by IS DISTINCT FROM OLD.assignee_id
  THEN
    -- Уведомление создателю — только если новой строки уведомления от
    -- server action ещё нет (защита от дубля).
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE linked_id = NEW.id
        AND type = 'direct_task'
        AND title = 'Задача отклонена'
        AND created_at > NOW() - INTERVAL '10 seconds'
    ) THEN
      INSERT INTO notifications (user_id, title, message, type, linked_id)
      VALUES (
        NEW.created_by,
        'Задача отклонена',
        'Исполнитель отклонил поручение: ' || NEW.title,
        'direct_task',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_direct_task_rejected ON direct_tasks;
CREATE TRIGGER notify_direct_task_rejected
  AFTER UPDATE OF assignee_id ON direct_tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_direct_task_rejected();


CREATE OR REPLACE FUNCTION trigger_notify_project_task_rejected()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.assignee_id IS NOT NULL
    AND NEW.assignee_id IS NULL
    AND NEW.created_by IS NOT NULL
    AND NEW.created_by IS DISTINCT FROM OLD.assignee_id
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE linked_id = NEW.id
        AND type = 'project_task'
        AND title = 'Задача отклонена'
        AND created_at > NOW() - INTERVAL '10 seconds'
    ) THEN
      INSERT INTO notifications (user_id, title, message, type, linked_id)
      VALUES (
        NEW.created_by,
        'Задача отклонена',
        'Исполнитель отклонил задачу: ' || NEW.title,
        'project_task',
        NEW.project_id  -- linked_id = project id, клик ведёт на канбан
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_project_task_rejected ON project_tasks;
CREATE TRIGGER notify_project_task_rejected
  AFTER UPDATE OF assignee_id ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_project_task_rejected();
