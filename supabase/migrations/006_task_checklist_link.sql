-- ============================================================
-- Связь задачи с пунктом чек-листа
-- ============================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS checklist_item_id UUID REFERENCES stage_checklist_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_checklist_item_id_idx ON tasks(checklist_item_id);
