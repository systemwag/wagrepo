-- ============================================================
-- Migration 068: RPC admin_cleanup_orphan_notifications
-- ============================================================
-- Зачем:
--   notifications.linked_id — не FK, а просто UUID. При удалении
--   связанной сущности (опроса, проекта, задачи, события) уведомления
--   остаются висеть с мёртвой ссылкой: клик ведёт в 404. С миграцией 067
--   эта боль становится особенно заметной — старые poll-уведомления
--   копились дублями, и теперь админу нужна одна кнопка «зачистить
--   осиротевшие».
--
-- Что делает: за один проход удаляет notifications, чей linked_id не
-- существует в соответствующей таблице. Маппинг type → таблица:
--   poll          → polls
--   event         → events
--   project       → projects
--   direct_task   → direct_tasks
--   project_task  → project_tasks
--   system        — не трогаем (linked_id обычно null или произвольный)
--
-- SECURITY DEFINER + явный role check внутри — обходим RLS, но не даём
-- не-админу её дёрнуть.
--
-- Возвращает суммарное число удалённых строк.
-- ============================================================

DROP FUNCTION IF EXISTS admin_cleanup_orphan_notifications();

CREATE OR REPLACE FUNCTION admin_cleanup_orphan_notifications()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  TEXT;
  v_count INT;
  v_total INT := 0;
BEGIN
  SELECT p.role::TEXT INTO v_role FROM profiles p WHERE p.id = auth.uid();
  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Только admin может чистить осиротевшие уведомления';
  END IF;

  DELETE FROM notifications n
   WHERE n.type = 'poll'
     AND n.linked_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM polls x WHERE x.id = n.linked_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  DELETE FROM notifications n
   WHERE n.type = 'event'
     AND n.linked_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM events x WHERE x.id = n.linked_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  DELETE FROM notifications n
   WHERE n.type = 'project'
     AND n.linked_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM projects x WHERE x.id = n.linked_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  DELETE FROM notifications n
   WHERE n.type = 'direct_task'
     AND n.linked_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM direct_tasks x WHERE x.id = n.linked_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  DELETE FROM notifications n
   WHERE n.type = 'project_task'
     AND n.linked_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM project_tasks x WHERE x.id = n.linked_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_cleanup_orphan_notifications() TO authenticated;
