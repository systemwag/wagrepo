-- ============================================================
-- Migration 055: realtime для events и event_participants
-- ============================================================
-- Цель: календарь обновляется без перезагрузки, когда другой
-- пользователь создаёт/правит/удаляет событие или меняет состав
-- участников. Особенно важно для совместной работы нескольких
-- директоров в офисе.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE events;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'event_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_participants;
  END IF;
END $$;
