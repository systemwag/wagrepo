-- ============================================================
-- Migration 064: RPC admin_delete_daily_by_dates — массовое удаление
-- дейли-отчётов админом за указанные дни.
-- ============================================================
-- Зачем:
--   RLS dr_delete (миграция 062) пускает только автора, и только в окне
--   [вчера..сегодня]. Это защита прошлого для обычных пользователей.
--   Админ должен иметь обходную ручку, чтобы чистить тестовые/мусорные
--   отчёты любых дат. SECURITY DEFINER + явный role-check внутри.
--
-- CASCADE: daily_report_tasks и daily_report_reactions удаляются
-- автоматически через ON DELETE CASCADE (определены в 015 и 062).
-- ============================================================

DROP FUNCTION IF EXISTS admin_delete_daily_by_dates(DATE[]);

CREATE OR REPLACE FUNCTION admin_delete_daily_by_dates(p_dates DATE[])
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  TEXT;
  v_count INT;
BEGIN
  SELECT p.role::TEXT INTO v_role FROM profiles p WHERE p.id = auth.uid();
  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Только admin может удалять дейли-отчёты массово';
  END IF;

  IF p_dates IS NULL OR array_length(p_dates, 1) IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM daily_reports WHERE report_date = ANY(p_dates);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_daily_by_dates(DATE[]) TO authenticated;
