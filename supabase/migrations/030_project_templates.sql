-- ============================================================
-- Migration 030: шаблоны проектов
-- ============================================================
-- Снимает hardcoded 8 этапов «проектирования» и переводит структуру
-- этапов проекта на конфигурируемые шаблоны. Один шаблон = набор
-- этапов + чек-листы. При создании проекта пользователь выбирает шаблон
-- (или используется default).
--
-- Этап 1 миграции — только схема таблиц + FK + RLS. Сама миграция данных
-- (перенос текущих 8 design-этапов в шаблон «Проектирование») —
-- в следующей миграции 031, потому что seed-данные удобнее вести отдельно.
-- ============================================================

-- ── 1. project_templates ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  -- Имя иконки из Lucide (например 'building-2', 'hammer', 'briefcase').
  -- Хранится строкой, чтобы можно было выбирать в UI без миграции на каждое.
  icon        TEXT,
  -- HEX-цвет для визуальной разметки шаблона в UI.
  color       TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Только один шаблон может быть default-ом одновременно. Используем
-- partial unique index — гибче чем CHECK + триггер.
CREATE UNIQUE INDEX uniq_project_templates_default
  ON project_templates (is_default) WHERE is_default = TRUE;

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select" ON project_templates FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "templates_insert" ON project_templates FOR INSERT TO authenticated WITH CHECK (has_director_access());
CREATE POLICY "templates_update" ON project_templates FOR UPDATE TO authenticated USING (has_director_access());
CREATE POLICY "templates_delete" ON project_templates FOR DELETE TO authenticated USING (has_director_access());

CREATE TRIGGER set_updated_at_project_templates
  BEFORE UPDATE ON project_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 2. template_stages ────────────────────────────────────────────────────
CREATE TABLE template_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  stage_key   TEXT,            -- опциональный машинный идентификатор (например 'contract')
  order_index INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_stages_template ON template_stages(template_id, order_index);

ALTER TABLE template_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template_stages_select" ON template_stages FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "template_stages_insert" ON template_stages FOR INSERT TO authenticated WITH CHECK (has_director_access());
CREATE POLICY "template_stages_update" ON template_stages FOR UPDATE TO authenticated USING (has_director_access());
CREATE POLICY "template_stages_delete" ON template_stages FOR DELETE TO authenticated USING (has_director_access());

-- ── 3. template_checklist_items ───────────────────────────────────────────
CREATE TABLE template_checklist_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_stage_id UUID NOT NULL REFERENCES template_stages(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  order_index       INT NOT NULL DEFAULT 0,
  is_required       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_checklist_stage ON template_checklist_items(template_stage_id, order_index);

ALTER TABLE template_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template_checklist_select" ON template_checklist_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "template_checklist_insert" ON template_checklist_items FOR INSERT TO authenticated WITH CHECK (has_director_access());
CREATE POLICY "template_checklist_update" ON template_checklist_items FOR UPDATE TO authenticated USING (has_director_access());
CREATE POLICY "template_checklist_delete" ON template_checklist_items FOR DELETE TO authenticated USING (has_director_access());

-- ── 4. projects.template_id ───────────────────────────────────────────────
-- Привязка проекта к шаблону. NULL для старых проектов до миграции 031.
ALTER TABLE projects
  ADD COLUMN template_id UUID REFERENCES project_templates(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_template ON projects(template_id) WHERE template_id IS NOT NULL;
