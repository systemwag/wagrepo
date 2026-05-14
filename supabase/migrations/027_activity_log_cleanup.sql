-- ============================================================
-- Migration 027: activity_log cleanup
-- ============================================================
-- 1. RLS DELETE-политика — только директор может удалять.
-- 2. SQL-функция cleanup_old_activity_log() — удаляет старее 30 дней.
-- 3. pg_cron расписание — запускает функцию каждую ночь в 03:00 UTC.
--
-- Если pg_cron в вашем Supabase-проекте не активирован — последний
-- блок (`SELECT cron.schedule(...)`) упадёт. Активировать можно в
-- Dashboard → Database → Extensions → pg_cron.
-- ============================================================

-- ── 1. Политика удаления (только директор) ────────────────────────────────
DROP POLICY IF EXISTS "activity_log_delete" ON activity_log;
CREATE POLICY "activity_log_delete" ON activity_log FOR DELETE TO authenticated USING (
  get_my_role() = 'director'
);

-- ── 2. Функция автоочистки ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_activity_log()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_activity_log() TO authenticated;

-- ── 3. Расписание pg_cron ─────────────────────────────────────────────────
-- Запускаем каждый день в 03:00 UTC (≈ 08:00 Asia/Oral).
-- Перед регистрацией удаляем старую задачу с тем же именем, если она была.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Снимаем предыдущую регистрацию (если повторно запускаем миграцию).
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup_activity_log') THEN
      PERFORM cron.unschedule('cleanup_activity_log');
    END IF;

    PERFORM cron.schedule(
      'cleanup_activity_log',
      '0 3 * * *',
      $job$ SELECT cleanup_old_activity_log() $job$
    );
  ELSE
    RAISE NOTICE 'pg_cron не активирован — автоочистка не настроена. Включите расширение pg_cron и перезапустите миграцию.';
  END IF;
END $$;
