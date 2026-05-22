-- ============================================================
-- Migration 063: RPC get_daily_team_window — единый запрос для
-- вкладок «Сегодня» и «История» в /dashboard/daily/team.
-- ============================================================
-- Зачем:
--   До этой миграции страница «История» делала PostgREST embed-запрос
--   с тремя связями (report_tasks + reactions + author) — на каждой
--   строке Postgres вычислял RLS-политики dr_select / drt_select /
--   drr_select, каждая из которых делает SELECT role FROM profiles.
--   На 12 отчётах с 14-дневным окном это давало 1300–1900ms на холодном
--   пуле PostgREST. Замер: today (8 строк) 4ms/409ms/870ms — разброс
--   ×100 на одном и том же запросе, history стабильно +1000ms над today.
--
-- Что делает функция:
--   ОДИН SQL select с JOIN profiles + jsonb_agg для коллекций
--   (report_tasks, reactions). SECURITY DEFINER + явный access-check
--   обходит RLS-вычисления на embedded связях, делает их за один проход.
--
-- Используется в:
--   - /dashboard/daily/team (вкладка «Сегодня»): p_from = p_to = today
--   - /dashboard/daily/team?view=history:        диапазон [until-days+1 .. until]
-- ============================================================

-- DROP IF EXISTS на случай повторного применения / правки сигнатуры
DROP FUNCTION IF EXISTS get_daily_team_window(DATE, DATE);

CREATE OR REPLACE FUNCTION get_daily_team_window(p_from DATE, p_to DATE)
RETURNS TABLE (
  id            UUID,
  author_id     UUID,
  report_date   DATE,
  did_today     TEXT,
  plan_tomorrow TEXT,
  has_blocker   BOOLEAN,
  blocker_text  TEXT,
  workload      SMALLINT,
  created_at    TIMESTAMPTZ,
  report_tasks  JSONB,
  reactions     JSONB,
  author        JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Один access-check вместо N×RLS-вычислений по строкам.
  -- Дублирует логику dr_select из миграций 015/062 (на текущий момент:
  -- director/manager/admin видят всех; employee — только свои отчёты).
  -- Сотрудник идёт мимо этой ручки — отдаём пусто.
  SELECT p.role::TEXT INTO v_role FROM profiles p WHERE p.id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('director', 'manager', 'admin') THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      dr.id,
      dr.author_id,
      dr.report_date,
      dr.did_today,
      dr.plan_tomorrow,
      dr.has_blocker,
      dr.blocker_text,
      dr.workload,
      dr.created_at,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',              t.id,
            'direct_task_id',  t.direct_task_id,
            'project_task_id', t.project_task_id,
            'stage_id',        t.stage_id,
            'task_title',      t.task_title,
            'hours_spent',     t.hours_spent,
            'is_completed',    t.is_completed
          )
        )
        FROM daily_report_tasks t WHERE t.report_id = dr.id
      ), '[]'::jsonb) AS report_tasks,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('emoji', r.emoji, 'profile_id', r.profile_id)
        )
        FROM daily_report_reactions r WHERE r.report_id = dr.id
      ), '[]'::jsonb) AS reactions,
      jsonb_build_object(
        'id',         p.id,
        'full_name',  p.full_name,
        'position',   p.position,
        'role',       p.role::TEXT,
        'department', p.department
      ) AS author
    FROM daily_reports dr
    JOIN profiles p ON p.id = dr.author_id
    WHERE dr.report_date BETWEEN p_from AND p_to
    ORDER BY dr.report_date DESC, dr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_daily_team_window(DATE, DATE) TO authenticated;
