-- Добавить поддержку этапов проекта в дейли-отчёты
ALTER TABLE daily_report_tasks
  ADD COLUMN stage_id uuid REFERENCES project_stages(id) ON DELETE SET NULL;
