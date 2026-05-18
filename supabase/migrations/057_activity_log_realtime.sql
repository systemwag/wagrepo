-- ============================================================
-- Migration 057: realtime для activity_log
-- ============================================================
-- Нужно, чтобы вкладка «Прогресс» на странице проекта обновлялась
-- без перезагрузки, когда команда в реальном времени двигает задачи,
-- отмечает чек-листы и прикрепляет документы.
--
-- RLS на SELECT уже расширен в миграции 052 (события проекта/этапа/
-- задачи видны всем authenticated). Realtime уважает RLS — клиент
-- получит только разрешённые ему события.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'activity_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
  END IF;
END $$;
