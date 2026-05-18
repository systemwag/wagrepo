-- ============================================================
-- Migration 056: триггер уведомлений для опросов с audience='all'
-- шлёт уведомления только активным сотрудникам
-- ============================================================
-- Зачем: в миграции 051 функция trigger_notify_poll_all() рассылала
-- уведомления ВСЕМ profiles без фильтра is_active. Уволенные получали
-- строки в notifications, которые никто никогда не прочитает — мусорные
-- ряды в БД и лишняя работа push-вебхука (на запросы к их push_subscriptions).
--
-- Просто пересоздаём функцию с фильтром is_active = true.
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_notify_poll_all()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.audience = 'all' THEN
    INSERT INTO notifications (user_id, title, message, type, linked_id)
    SELECT
      p.id,
      'Новый опрос',
      'Вам предложено ответить: «' || NEW.question || '»',
      'poll',
      NEW.id
    FROM profiles p
    WHERE p.id <> NEW.created_by
      AND p.is_active = true;
  END IF;
  RETURN NEW;
END;
$$;
