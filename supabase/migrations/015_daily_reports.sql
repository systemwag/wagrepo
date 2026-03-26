-- ==========================================================
-- 015_daily_reports.sql — Дейли-отчёты
-- ==========================================================

CREATE TABLE daily_reports (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id     uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  report_date   date NOT NULL DEFAULT CURRENT_DATE,
  did_today     text NOT NULL,
  plan_tomorrow text,
  has_blocker   boolean NOT NULL DEFAULT false,
  blocker_text  text,
  workload      smallint CHECK (workload BETWEEN 1 AND 5),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(author_id, report_date)
);

-- Задачи внутри отчёта (один отчёт — несколько задач)
CREATE TABLE daily_report_tasks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id   uuid REFERENCES daily_reports(id) ON DELETE CASCADE NOT NULL,
  task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
  task_title  text NOT NULL,
  hours_spent numeric(4,1) NOT NULL CHECK (hours_spent > 0)
);

-- Индексы
CREATE INDEX idx_daily_reports_author ON daily_reports(author_id);
CREATE INDEX idx_daily_reports_date   ON daily_reports(report_date DESC);
CREATE INDEX idx_drt_report_id        ON daily_report_tasks(report_id);

-- Автообновление updated_at
CREATE OR REPLACE FUNCTION update_daily_reports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION update_daily_reports_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE daily_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_tasks ENABLE ROW LEVEL SECURITY;

-- Свои отчёты + менеджер/директор видят все
CREATE POLICY "dr_select" ON daily_reports
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('director', 'manager')
  );

CREATE POLICY "dr_insert" ON daily_reports
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "dr_update" ON daily_reports
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "dr_delete" ON daily_reports
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- daily_report_tasks: доступ через parent report
CREATE POLICY "drt_select" ON daily_report_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND (
          dr.author_id = auth.uid()
          OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('director', 'manager')
        )
    )
  );

CREATE POLICY "drt_insert" ON daily_report_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id AND dr.author_id = auth.uid()
    )
  );

CREATE POLICY "drt_delete" ON daily_report_tasks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id AND dr.author_id = auth.uid()
    )
  );
