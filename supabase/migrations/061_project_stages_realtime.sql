-- ============================================================
-- Migration 061: realtime для этапов проекта
-- ============================================================
-- Без realtime на этих таблицах вкладка «Этапы» проекта обновляется
-- только после router.refresh() у того, кто менял. Чтобы команда
-- видела статусы/прогресс друг друга мгновенно — добавляем три
-- таблицы в publication supabase_realtime:
--   - project_stages       (статус, дедлайн, ассигни, ревью этапа);
--   - stage_checklist_items (отметки и состав чек-листа);
--   - documents            (прикрепление/удаление файлов на этапе).
--
-- RLS уже разрешает чтение этих таблиц всем authenticated, поэтому
-- клиент получит только разрешённые ему изменения.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND tablename = 'project_stages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_stages;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND tablename = 'stage_checklist_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE stage_checklist_items;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND tablename = 'documents') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE documents;
  END IF;
END $$;
