-- ============================================================
-- Migration 032: order_index у project_tasks
-- ============================================================
-- Добавляет колонку order_index — позволяет менеджеру вручную ранжировать
-- задачи внутри этапа (drag-and-drop / стрелки на mobile).
-- Существующим задачам проставляется порядок по created_at (стабильно,
-- предсказуемо). Новые задачи получают MAX(order_index)+1 в своём stage_id —
-- логика на стороне приложения.
-- ============================================================

-- ── 1. Колонка ─────────────────────────────────────────────────────────────
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS order_index INT;

-- ── 2. Бэкфил: проставляем порядок по created_at внутри stage_id ──────────
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY stage_id ORDER BY created_at, id) AS rn
    FROM project_tasks
   WHERE order_index IS NULL
)
UPDATE project_tasks pt
   SET order_index = o.rn
  FROM ordered o
 WHERE pt.id = o.id;

-- ── 3. Закрепляем NOT NULL + default ──────────────────────────────────────
ALTER TABLE project_tasks
  ALTER COLUMN order_index SET DEFAULT 0,
  ALTER COLUMN order_index SET NOT NULL;

-- ── 4. Индекс под выборку и сортировку ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_tasks_stage_order
  ON project_tasks(stage_id, order_index);
