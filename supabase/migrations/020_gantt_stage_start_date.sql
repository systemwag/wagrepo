-- Migration 020: добавить start_date в project_stages для Гантта
-- Позволяет задавать явную дату начала каждого этапа
-- (параллельные этапы, паузы между ними)

ALTER TABLE project_stages
  ADD COLUMN IF NOT EXISTS start_date DATE;

-- Комментарий
COMMENT ON COLUMN project_stages.start_date IS
  'Явная дата начала этапа. Если NULL — вычисляется автоматически (дедлайн предыдущего этапа).';
