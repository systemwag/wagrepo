-- ==========================================================
-- 013_event_notifications.sql
-- Уведомления при добавлении участника к мероприятию
-- ==========================================================

-- Добавляем значение 'event' в enum (если ещё нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'event'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'event';
  END IF;
END;
$$;

-- Триггерная функция: уведомить участника при добавлении в мероприятие
CREATE OR REPLACE FUNCTION trigger_notify_event_participant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_title text;
  v_event_date  date;
  v_creator_id  uuid;
BEGIN
  SELECT title, date, created_by
    INTO v_event_title, v_event_date, v_creator_id
    FROM events
   WHERE id = NEW.event_id;

  -- Не уведомлять создателя о собственном мероприятии
  IF NEW.user_id IS DISTINCT FROM v_creator_id THEN
    INSERT INTO notifications (user_id, title, message, type, linked_id)
    VALUES (
      NEW.user_id,
      'Новое мероприятие',
      'Вы добавлены как участник: «' || v_event_title || '» ('
        || to_char(v_event_date, 'DD.MM.YYYY') || ')',
      'event',
      NEW.event_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_event_participant ON event_participants;
CREATE TRIGGER notify_event_participant
  AFTER INSERT ON event_participants
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_event_participant();
