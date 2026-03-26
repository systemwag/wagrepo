-- ============================================================
-- 018: Индексы для оптимизации производительности
-- ============================================================

-- tasks: частые фильтры и сортировки
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id   ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by    ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status        ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline      ON tasks(deadline) WHERE deadline IS NOT NULL;
-- составной: задачи пользователя не в статусе done (самый частый запрос)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee_id, status);

-- project_stages: фильтрация по проекту и исполнителю
CREATE INDEX IF NOT EXISTS idx_stages_project_id   ON project_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_stages_assignee_id  ON project_stages(assignee_id);
CREATE INDEX IF NOT EXISTS idx_stages_status       ON project_stages(status);

-- daily_reports: уникальный поиск по автору + дате
CREATE INDEX IF NOT EXISTS idx_daily_reports_author_date ON daily_reports(author_id, report_date DESC);

-- daily_report_tasks: быстрый join к отчёту
CREATE INDEX IF NOT EXISTS idx_daily_report_tasks_report_id ON daily_report_tasks(report_id);

-- notifications: уже есть idx_notifications_user_id и idx_notifications_created_at
-- добавляем составной для фильтра непрочитанных
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- activity_log: сортировка по времени (уже desc — актуально для pagination)
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id   ON activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity     ON activity_log(entity_type, entity_id);

-- events: фильтр по дате
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- profiles: частые фильтры
CREATE INDEX IF NOT EXISTS idx_profiles_role      ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active) WHERE is_active = true;
