-- ============================================================
-- Migration 032: аудит смен статусов задач/поручений в activity_log
-- ============================================================
-- Дополнение к существующему логированию через writeLog() в Server Actions.
-- DB-trigger срабатывает на любое изменение status в direct_tasks/project_tasks,
-- даже если оно сделано напрямую через SQL/Supabase Dashboard, минуя приложение.
-- Это даёт честную историю переходов для будущей аналитики «узких мест».
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_audit_direct_task_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- actor_id = auth.uid() если действие из app, NULL если из системы/SQL.
    INSERT INTO activity_log (actor_id, entity_type, entity_id, action, meta)
    VALUES (
      auth.uid(),
      'direct_task',
      NEW.id,
      'direct_task.status_changed_audit',
      jsonb_build_object(
        'from_status', OLD.status,
        'to_status',   NEW.status,
        'title',       NEW.title,
        'changed_at',  NOW()
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_direct_task_status ON direct_tasks;
CREATE TRIGGER audit_direct_task_status
  AFTER UPDATE OF status ON direct_tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_direct_task_status();


CREATE OR REPLACE FUNCTION trigger_audit_project_task_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO activity_log (actor_id, entity_type, entity_id, action, meta)
    VALUES (
      auth.uid(),
      'project_task',
      NEW.id,
      'project_task.status_changed_audit',
      jsonb_build_object(
        'from_status', OLD.status,
        'to_status',   NEW.status,
        'title',       NEW.title,
        'project_id',  NEW.project_id,
        'stage_id',    NEW.stage_id,
        'changed_at',  NOW()
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_project_task_status ON project_tasks;
CREATE TRIGGER audit_project_task_status
  AFTER UPDATE OF status ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_project_task_status();

-- Замечание: actor_id может быть NULL при изменении из Supabase Dashboard
-- (там нет JWT). RLS на activity_log INSERT требует actor_id = auth.uid(),
-- но триггер выполняется SECURITY DEFINER → правит таблицу от имени владельца
-- функции, RLS не применяется. Безопасно.
