-- ============================================================
-- Migration 062: полировка модуля дейли-отчёта
-- ============================================================
-- Изменения:
--  1. RLS: добавить admin в dr_select / drt_select (виджеты под админом).
--  2. RLS: запретить UPDATE/DELETE отчётов старше «вчера» по Asia/Oral —
--     защита прошлого. Грейс-окно 1 день, чтобы можно было сдать
--     пропущенный день и тут же исправить опечатку.
--  3. INSERT policy: report_date ∈ {сегодня, вчера} по Asia/Oral
--     (server action и так пишет сегодня, но открываем дверь для
--     поздней сдачи через дополнительный аргумент input.report_date).
--  4. Realtime: подписка на daily_reports + daily_report_tasks
--     (директор на /daily/team увидит новые отчёты без F5).
--  5. Таблица daily_report_reactions — эмодзи-реакции на чужой отчёт.
--  6. RPC get_my_daily_streak(p_user_id) — текущая полоса дней подряд,
--     считается на стороне Postgres, не «капает» обратно при пустой
--     истории.
--  7. RPC get_silent_employees_today: добавить department в выдачу
--     (для группировки в /daily/team).
-- ============================================================

-- ── 1. RLS dr_select / drt_select: admin тоже видит все отчёты ───────────
DROP POLICY IF EXISTS "dr_select" ON daily_reports;
CREATE POLICY "dr_select" ON daily_reports
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('director', 'manager', 'admin')
  );

DROP POLICY IF EXISTS "drt_select" ON daily_report_tasks;
CREATE POLICY "drt_select" ON daily_report_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND (
          dr.author_id = auth.uid()
          OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('director', 'manager', 'admin')
        )
    )
  );


-- ── 2. INSERT/UPDATE/DELETE: report_date ∈ {сегодня, вчера} ───────────────
-- Запрет правок старше «вчера» по Asia/Oral. Грейс-окно 1 день.
DROP POLICY IF EXISTS "dr_insert" ON daily_reports;
CREATE POLICY "dr_insert" ON daily_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND report_date >= ((NOW() AT TIME ZONE 'Asia/Oral')::date - INTERVAL '1 day')
    AND report_date <= ((NOW() AT TIME ZONE 'Asia/Oral')::date)
  );

DROP POLICY IF EXISTS "dr_update" ON daily_reports;
CREATE POLICY "dr_update" ON daily_reports
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    AND report_date >= ((NOW() AT TIME ZONE 'Asia/Oral')::date - INTERVAL '1 day')
  )
  WITH CHECK (
    author_id = auth.uid()
    AND report_date >= ((NOW() AT TIME ZONE 'Asia/Oral')::date - INTERVAL '1 day')
    AND report_date <= ((NOW() AT TIME ZONE 'Asia/Oral')::date)
  );

DROP POLICY IF EXISTS "dr_delete" ON daily_reports;
CREATE POLICY "dr_delete" ON daily_reports
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    AND report_date >= ((NOW() AT TIME ZONE 'Asia/Oral')::date - INTERVAL '1 day')
  );


-- ── 3. Realtime: daily_reports + daily_report_tasks ──────────────────────
-- Идемпотентно: если таблица уже в публикации — ADD кидает ошибку.
-- Оборачиваем в DO/EXCEPTION, чтобы повтор миграции не падал.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE daily_reports;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE daily_report_tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 4. daily_report_reactions: эмодзи-отклик руководителя на отчёт ────────
-- Один пользователь — одна реакция на отчёт. Изменить эмодзи = UPSERT.
-- Поле emoji хранит короткий kind-ключ ('ok' / 'love' / 'fire' / 'eye' / 'ask'
-- — см. src/lib/constants/workload.ts), не сам utf-эмодзи. CHECK до 16
-- символов оставляет запас на случай добавления более описательных ключей.
CREATE TABLE IF NOT EXISTS daily_report_reactions (
  report_id   UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  emoji       TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (report_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_drr_report ON daily_report_reactions(report_id);

ALTER TABLE daily_report_reactions ENABLE ROW LEVEL SECURITY;

-- Видят: автор отчёта (его поощряют), сам поставивший, любой director/manager/admin.
DROP POLICY IF EXISTS "drr_select" ON daily_report_reactions;
CREATE POLICY "drr_select" ON daily_report_reactions
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id AND dr.author_id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('director', 'manager', 'admin')
  );

-- Ставят только руководители (manager+).
DROP POLICY IF EXISTS "drr_insert" ON daily_report_reactions;
CREATE POLICY "drr_insert" ON daily_report_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('director', 'manager', 'admin')
  );

DROP POLICY IF EXISTS "drr_update" ON daily_report_reactions;
CREATE POLICY "drr_update" ON daily_report_reactions
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "drr_delete" ON daily_report_reactions;
CREATE POLICY "drr_delete" ON daily_report_reactions
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

-- Реалтайм для реакций — UI обновится мгновенно у автора отчёта.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE daily_report_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 5. RPC: текущий streak — считается на сервере без зависимости от 14-дней истории ──
CREATE OR REPLACE FUNCTION get_my_daily_streak(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Oral')::date;
  v_cursor DATE;
  v_has BOOLEAN;
  v_streak INT := 0;
BEGIN
  -- Проверяем сегодня; если не сдан — стартуем с вчера.
  SELECT EXISTS (
    SELECT 1 FROM daily_reports
     WHERE author_id = p_user_id AND report_date = v_today
  ) INTO v_has;

  v_cursor := CASE WHEN v_has THEN v_today ELSE v_today - 1 END;

  LOOP
    SELECT EXISTS (
      SELECT 1 FROM daily_reports
       WHERE author_id = p_user_id AND report_date = v_cursor
    ) INTO v_has;

    EXIT WHEN NOT v_has;
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;

    -- Защита от бесконечного цикла (вдруг данные с будущей даты).
    EXIT WHEN v_streak > 3650;
  END LOOP;

  RETURN v_streak;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_daily_streak(UUID) TO authenticated;


-- ── 6. RPC: get_silent_employees_today + department ──────────────────────
-- Был с position только. Возвращаем department отдельным полем — нужно
-- для группировки в /daily/team. Сохраняем существующую сигнатуру:
-- (p_limit INT DEFAULT 30), добавляем колонку — это меняет TABLE-сигнатуру.
-- Чтобы Supabase RPC не упал на overload, DROP + CREATE.
DROP FUNCTION IF EXISTS get_silent_employees_today(INT);
DROP FUNCTION IF EXISTS get_silent_employees_today();

CREATE OR REPLACE FUNCTION get_silent_employees_today(p_limit INT DEFAULT 30)
RETURNS TABLE (
  id          UUID,
  full_name   TEXT,
  role        TEXT,
  "position"  TEXT,
  department  TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.role::TEXT AS role, p.position, p.department
    FROM profiles p
    LEFT JOIN daily_reports dr
      ON dr.author_id = p.id
     AND dr.report_date = (NOW() AT TIME ZONE 'Asia/Oral')::date
   WHERE p.is_active = true
     AND p.role IN ('employee', 'manager')
     AND dr.id IS NULL
   ORDER BY p.full_name
   LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_silent_employees_today(INT) TO authenticated;
