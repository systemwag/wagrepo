-- ============================================================
-- Migration 038: projects.current_stage_id — текущий этап проекта
-- ============================================================
-- Идемпотентная — можно запускать повторно.
-- Отдельное поле от project_stages.status: показывает, на каком этапе
-- проект «находится сейчас» в общей канбан-доске проектов.
-- Менеджер может вручную двигать проект между этапами (DnD на доске
-- /dashboard/projects/board), не меняя статусы конкретных этапов.
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS current_stage_id UUID
    REFERENCES project_stages(id) ON DELETE SET NULL;

-- Бэкфил: для каждого активного проекта ставим первый этап
-- со статусом, отличным от 'completed' (или самый ранний если все завершены).
WITH first_open_stage AS (
  SELECT DISTINCT ON (project_id)
         project_id, id
    FROM project_stages
   WHERE status <> 'completed'
   ORDER BY project_id, order_index ASC
),
fallback_stage AS (
  -- На случай если все этапы completed — берём самый последний
  SELECT DISTINCT ON (project_id)
         project_id, id
    FROM project_stages
   ORDER BY project_id, order_index DESC
)
UPDATE projects p
   SET current_stage_id = COALESCE(fos.id, fs.id)
  FROM projects px
  LEFT JOIN first_open_stage fos ON fos.project_id = px.id
  LEFT JOIN fallback_stage  fs  ON fs.project_id  = px.id
 WHERE p.id = px.id
   AND p.current_stage_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_current_stage
  ON projects(current_stage_id) WHERE current_stage_id IS NOT NULL;

-- ── Автозаполнение при создании этапов нового проекта ─────────────────────
-- Когда у проекта появляется первый этап — назначаем его как current_stage,
-- если current_stage ещё не задан.
CREATE OR REPLACE FUNCTION sync_project_initial_stage()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE projects
     SET current_stage_id = NEW.id
   WHERE id = NEW.project_id
     AND current_stage_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_project_initial_stage ON project_stages;
CREATE TRIGGER sync_project_initial_stage
  AFTER INSERT ON project_stages
  FOR EACH ROW EXECUTE FUNCTION sync_project_initial_stage();
