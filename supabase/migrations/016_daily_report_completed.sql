-- Добавить флаг завершения к задачам в дейли-отчёте
ALTER TABLE daily_report_tasks ADD COLUMN is_completed boolean NOT NULL DEFAULT false;
