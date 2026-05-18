-- ============================================================
-- Migration 058: fix timezone в дейли-отчётах + вечернее напоминание
-- ============================================================
-- (1) get_silent_employees_today() сравнивал с CURRENT_DATE (UTC).
--     В Asia/Oral (UTC+5) утром ещё «вчера» по UTC → виджет «кто не
--     сдал» показывал сотрудников, которые сдали отчёт за сегодня
--     по Оралу. Переписываем с привязкой к Asia/Oral.
--
-- (2) notify_silent_employees_daily() — рассылает напоминание тем,
--     кто не сдал отчёт за сегодня. Триггер на INSERT в notifications
--     запустит обычный push-pipeline через webhook.
--
-- (3) pg_cron — расписание 13:00 UTC ≈ 18:00 Asia/Oral в рабочие дни
--     (понедельник-суббота). Воскресенье пропускаем — стройка в WAG
--     иногда работает в субботу, но не в воскресенье.
-- ============================================================

-- ── 1. Timezone-aware версия RPC «кто не сдал сегодня» ─────────────────────
CREATE OR REPLACE FUNCTION get_silent_employees_today()
RETURNS TABLE (
  id          UUID,
  full_name   TEXT,
  role        TEXT,
  "position"  TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.role::TEXT AS role, p.position
    FROM profiles p
   WHERE p.is_active = true
     AND p.role IN ('employee', 'manager')
     AND NOT EXISTS (
       SELECT 1
         FROM daily_reports dr
        WHERE dr.author_id = p.id
          AND dr.report_date = (NOW() AT TIME ZONE 'Asia/Oral')::date
     )
   ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION get_silent_employees_today() TO authenticated;


-- ── 2. Функция вечернего напоминания ───────────────────────────────────────
-- Вставляет одно уведомление каждому, кто не сдал отчёт сегодня.
-- Тип 'system' — клик ведёт без перехода (пользователь сам идёт на /daily).
-- SECURITY DEFINER позволяет вставлять записи в notifications от имени
-- владельца функции, в обход RLS, для произвольных user_id.
CREATE OR REPLACE FUNCTION notify_silent_employees_daily()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH inserted AS (
    INSERT INTO notifications (user_id, title, message, type)
    SELECT
      p.id,
      'Не забудьте сдать дейли-отчёт',
      'Отчёт за сегодня ещё не отправлен. Это занимает минуту.',
      'system'::notification_type
      FROM profiles p
     WHERE p.is_active = true
       AND p.role IN ('employee', 'manager')
       AND NOT EXISTS (
         SELECT 1 FROM daily_reports dr
          WHERE dr.author_id = p.id
            AND dr.report_date = (NOW() AT TIME ZONE 'Asia/Oral')::date
       )
       -- Не дубль: уже отправляли сегодня?
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
          WHERE n.user_id = p.id
            AND n.title = 'Не забудьте сдать дейли-отчёт'
            AND (n.created_at AT TIME ZONE 'Asia/Oral')::date
                = (NOW() AT TIME ZONE 'Asia/Oral')::date
       )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM inserted;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION notify_silent_employees_daily() TO authenticated;


-- ── 3. pg_cron расписание — 13:00 UTC = 18:00 Asia/Oral, пн-сб ─────────────
-- pg_cron активируется в Dashboard → Database → Extensions → pg_cron.
-- Если extension не установлен — секция пропускается с notice,
-- остальная часть миграции остаётся валидной (RPC + функция готовы).
-- Идемпотентно: снимаем старую задачу с тем же именем перед регистрацией.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron не установлен — расписание не зарегистрировано. Активируйте в Dashboard → Database → Extensions → pg_cron и запустите миграцию повторно.';
    RETURN;
  END IF;

  BEGIN
    PERFORM cron.unschedule('notify-silent-daily');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'notify-silent-daily',
    '0 13 * * 1-6',
    'SELECT notify_silent_employees_daily();'
  );
END $$;
