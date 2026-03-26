-- ============================================================
-- Migration 002: Design Stages & Checklist
-- ============================================================

-- Тип проекта
CREATE TYPE project_type AS ENUM ('design', 'construction');

-- Статус этапа
CREATE TYPE stage_status AS ENUM ('pending', 'in_progress', 'completed', 'blocked');

-- ============================================================
-- Добавить project_type в projects (все текущие = 'design')
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type project_type NOT NULL DEFAULT 'design';

-- ============================================================
-- Расширить project_stages новыми полями
-- (assignee_id и deadline уже существуют)
-- ============================================================
ALTER TABLE project_stages
  ADD COLUMN IF NOT EXISTS stage_key    TEXT,
  ADD COLUMN IF NOT EXISTS status       stage_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes        TEXT;

-- ============================================================
-- stage_checklist_items — чек-листы этапов
-- ============================================================
CREATE TABLE IF NOT EXISTS stage_checklist_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id     UUID NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  is_required  BOOLEAN NOT NULL DEFAULT TRUE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE stage_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Все видят чек-листы"
  ON stage_checklist_items FOR SELECT USING (TRUE);

CREATE POLICY "Все сотрудники отмечают пункты"
  ON stage_checklist_items FOR UPDATE USING (TRUE);

CREATE POLICY "Директор и менеджер управляют чек-листами"
  ON stage_checklist_items FOR ALL
  USING (get_my_role() IN ('director', 'manager'));

-- ============================================================
-- Функция: автосоздание 8 этапов проектирования для проекта
-- ============================================================
CREATE OR REPLACE FUNCTION create_design_stages(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stage_id UUID;
BEGIN

  -- 1. Заключение договора
  INSERT INTO project_stages (project_id, name, stage_key, order_index)
    VALUES (p_project_id, 'Заключение договора', 'contract', 1)
    RETURNING id INTO v_stage_id;
  INSERT INTO stage_checklist_items (stage_id, label, order_index) VALUES
    (v_stage_id, 'Подписание договора с заказчиком', 1);

  -- 2. Изыскательные работы
  INSERT INTO project_stages (project_id, name, stage_key, order_index)
    VALUES (p_project_id, 'Изыскательные работы', 'surveys', 2)
    RETURNING id INTO v_stage_id;
  INSERT INTO stage_checklist_items (stage_id, label, order_index) VALUES
    (v_stage_id, 'Геодезия', 1),
    (v_stage_id, 'Геология', 2);

  -- 3. Получение исходных данных
  INSERT INTO project_stages (project_id, name, stage_key, order_index)
    VALUES (p_project_id, 'Получение исходных данных', 'initial_data', 3)
    RETURNING id INTO v_stage_id;
  INSERT INTO stage_checklist_items (stage_id, label, order_index) VALUES
    (v_stage_id, 'Правоустанавливающие документы на землю и собственность', 1),
    (v_stage_id, 'Технические условия на подключение к сетям', 2),
    (v_stage_id, 'АПЗ (Архитектурно-планировочное задание)', 3),
    (v_stage_id, 'Аэронавигационные данные', 4),
    (v_stage_id, 'Эскизный проект', 5),
    (v_stage_id, 'Протокол радон', 6),
    (v_stage_id, 'Протокол дозиметра', 7);

  -- 4. Разработка ПСД
  INSERT INTO project_stages (project_id, name, stage_key, order_index)
    VALUES (p_project_id, 'Разработка ПСД', 'psd', 4)
    RETURNING id INTO v_stage_id;
  INSERT INTO stage_checklist_items (stage_id, label, order_index) VALUES
    (v_stage_id, 'Проектная документация', 1),
    (v_stage_id, 'Сметная документация', 2);

  -- 5. Согласование проекта
  INSERT INTO project_stages (project_id, name, stage_key, order_index)
    VALUES (p_project_id, 'Согласование проекта', 'approval', 5)
    RETURNING id INTO v_stage_id;
  INSERT INTO stage_checklist_items (stage_id, label, order_index) VALUES
    (v_stage_id, 'Согласование с заказчиком', 1),
    (v_stage_id, 'Согласование с владельцами сетей (по каждому ТУ)', 2);

  -- 6. Разработка ОВОС
  INSERT INTO project_stages (project_id, name, stage_key, order_index)
    VALUES (p_project_id, 'Разработка ОВОС', 'ovos', 6)
    RETURNING id INTO v_stage_id;
  INSERT INTO stage_checklist_items (stage_id, label, order_index) VALUES
    (v_stage_id, 'Оценка влияния на окружающую среду', 1);

  -- 7. Государственная экспертиза
  INSERT INTO project_stages (project_id, name, stage_key, order_index)
    VALUES (p_project_id, 'Государственная экспертиза', 'expertise', 7)
    RETURNING id INTO v_stage_id;
  INSERT INTO stage_checklist_items (stage_id, label, order_index) VALUES
    (v_stage_id, 'Загрузка документации на портал Госэкспертизы', 1),
    (v_stage_id, 'Комплектация пакета документов', 2),
    (v_stage_id, 'Заключение договора с Госэкспертизой', 3),
    (v_stage_id, 'Начало экспертизы', 4),
    (v_stage_id, 'Завершение экспертизы — получение заключения', 5);

  -- 8. Выдача ПСД заказчику
  INSERT INTO project_stages (project_id, name, stage_key, order_index)
    VALUES (p_project_id, 'Выдача окончательной версии ПСД', 'final_delivery', 8)
    RETURNING id INTO v_stage_id;
  INSERT INTO stage_checklist_items (stage_id, label, order_index) VALUES
    (v_stage_id, 'Финальная передача ПСД заказчику', 1);

END;
$$ LANGUAGE plpgsql;
