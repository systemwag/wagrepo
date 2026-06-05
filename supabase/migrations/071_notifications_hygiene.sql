-- ============================================================
-- Migration 071: гигиена notifications
-- ============================================================
-- Контекст (замер 2026-06-05): таблица notifications крошечная по объёму
-- (208 kB / 300 строк), но 78% строк — дейли-напоминания type='system'
-- ('Не забудьте сдать дейли-отчёт') с read-rate всего 14.8%. Они копятся
-- непрочитанными и раздувают бейдж колокольчика до вечного «9+» → alert
-- fatigue, пользователь перестаёт доверять колокольчику и пропускает
-- реальные задачи (у которых read-rate 96–100%). Плюс ~13% строк —
-- осиротевшие (linked_id указывает на удалённую сущность → клик в 404).
--
-- Делаем три вещи:
--   1. Напоминание о дейли само-вычищается: при генерации новой пачки
--      удаляем вчерашние-и-старее напоминания (они уже бессмысленны).
--   2. Чистка осиротевших — выносим логику в internal-функцию без
--      role-гейта, вешаем на pg_cron (ежедневно) и прогоняем разово.
--   3. Автопокос прочитанных старше 90 дней — pg_cron, «поставил и забыл».
-- ============================================================

-- ── 1. Само-вычищающееся дейли-напоминание ────────────────────────────────
-- Перед вставкой новой пачки сносим напоминания за прошлые дни: «сдай отчёт
-- за вчера» сегодня уже не нужно. Сегодняшние не трогаем (их прикрывает
-- встроенный дедуп по дате ниже).
CREATE OR REPLACE FUNCTION notify_silent_employees_daily()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Снимаем устаревшие напоминания (за дни до сегодня по Asia/Oral).
  DELETE FROM notifications
   WHERE type = 'system'
     AND title = 'Не забудьте сдать дейли-отчёт'
     AND (created_at AT TIME ZONE 'Asia/Oral')::date
         < (NOW() AT TIME ZONE 'Asia/Oral')::date;

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


-- ── 2. Чистка осиротевших уведомлений ─────────────────────────────────────
-- Internal-функция без role-гейта: её дёргает pg_cron (там нет auth.uid(),
-- так что admin-проверка из 068 завалила бы вызов). Маппинг type → таблица
-- тот же, что в admin_cleanup_orphan_notifications. system не трогаем —
-- его linked_id произвольный.
CREATE OR REPLACE FUNCTION cleanup_orphan_notifications()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_total INT := 0;
BEGIN
  DELETE FROM notifications n
   WHERE n.type = 'poll' AND n.linked_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM polls x WHERE x.id = n.linked_id);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM notifications n
   WHERE n.type = 'event' AND n.linked_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM events x WHERE x.id = n.linked_id);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM notifications n
   WHERE n.type = 'project' AND n.linked_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM projects x WHERE x.id = n.linked_id);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM notifications n
   WHERE n.type = 'direct_task' AND n.linked_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM direct_tasks x WHERE x.id = n.linked_id);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM notifications n
   WHERE n.type = 'project_task' AND n.linked_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM project_tasks x WHERE x.id = n.linked_id);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  RETURN v_total;
END;
$$;

-- Admin-RPC из 068 теперь делегирует в общую функцию — одна копия логики,
-- но ручной вызов из UI по-прежнему под role-гейтом.
CREATE OR REPLACE FUNCTION admin_cleanup_orphan_notifications()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT p.role::TEXT INTO v_role FROM profiles p WHERE p.id = auth.uid();
  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Только admin может чистить осиротевшие уведомления';
  END IF;
  RETURN cleanup_orphan_notifications();
END;
$$;

GRANT EXECUTE ON FUNCTION admin_cleanup_orphan_notifications() TO authenticated;

-- Разовый прогон: снимаем ~38 уже накопившихся осиротевших.
SELECT cleanup_orphan_notifications();


-- ── 3. Автопокос прочитанных старше 90 дней ───────────────────────────────
CREATE OR REPLACE FUNCTION purge_old_read_notifications()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM notifications
   WHERE is_read = true
     AND created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ── 4. pg_cron расписания ─────────────────────────────────────────────────
-- pg_cron уже активен (дейли-напоминания шлются). Идемпотентно: снимаем
-- одноимённые задачи перед регистрацией. Время в UTC.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron не установлен — расписания не зарегистрированы. Активируйте в Dashboard → Database → Extensions → pg_cron и запустите миграцию повторно.';
    RETURN;
  END IF;

  -- Чистка осиротевших — ежедневно в 02:30 UTC (≈ 07:30 Asia/Oral, тихий час).
  BEGIN PERFORM cron.unschedule('cleanup-orphan-notifications'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule(
    'cleanup-orphan-notifications',
    '30 2 * * *',
    'SELECT cleanup_orphan_notifications();'
  );

  -- Автопокос прочитанных >90 дней — еженедельно, вс 03:00 UTC.
  BEGIN PERFORM cron.unschedule('purge-old-read-notifications'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule(
    'purge-old-read-notifications',
    '0 3 * * 0',
    'SELECT purge_old_read_notifications();'
  );
END $$;
