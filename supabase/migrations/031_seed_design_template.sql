-- ============================================================
-- Migration 031: seed шаблона «Проектирование» + RPC + backfill
-- ============================================================
-- 1. Создаёт RPC create_project_from_template(p_project_id, p_template_id)
--    — копирует этапы и чек-листы шаблона в project_stages + stage_checklist_items.
-- 2. Создаёт default-шаблон «Проектирование» с теми же 8 этапами и чек-листами,
--    что и в миграции 002.
-- 3. Обновляет projects.template_id для существующих проектов — привязывает
--    к default-шаблону.
-- 4. Старая функция create_design_stages переписана как тонкая обёртка, чтобы
--    весь существующий код продолжал работать без правок.
-- ============================================================

-- ── 1. RPC: применить шаблон к проекту ────────────────────────────────────
CREATE OR REPLACE FUNCTION create_project_from_template(
  p_project_id  UUID,
  p_template_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ts          RECORD;
  v_stage_id  UUID;
BEGIN
  -- Перебираем этапы шаблона по порядку и создаём соответствующие
  -- project_stages + чек-листы.
  FOR ts IN
    SELECT id, name, stage_key, order_index
      FROM template_stages
     WHERE template_id = p_template_id
     ORDER BY order_index
  LOOP
    INSERT INTO project_stages (project_id, name, stage_key, order_index)
      VALUES (p_project_id, ts.name, ts.stage_key, ts.order_index)
      RETURNING id INTO v_stage_id;

    INSERT INTO stage_checklist_items (stage_id, label, order_index, is_required)
    SELECT v_stage_id, tci.label, tci.order_index, tci.is_required
      FROM template_checklist_items tci
     WHERE tci.template_stage_id = ts.id
     ORDER BY tci.order_index;
  END LOOP;

  -- Фиксируем связь проект → шаблон (если ещё не зафиксирована)
  UPDATE projects SET template_id = p_template_id
    WHERE id = p_project_id AND template_id IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION create_project_from_template(UUID, UUID) TO authenticated;

-- ── 2. Seed: шаблон «Проектирование» ──────────────────────────────────────
DO $$
DECLARE
  v_template_id UUID;
  v_stage_id    UUID;
BEGIN
  -- Если уже есть default-шаблон — пропускаем (идемпотентность).
  IF EXISTS (SELECT 1 FROM project_templates WHERE is_default = TRUE) THEN
    RETURN;
  END IF;

  INSERT INTO project_templates (name, description, icon, color, is_default)
  VALUES (
    'Проектирование',
    '8 этапов классического цикла проектирования: договор → изыскания → ПСД → согласование → экспертиза → сдача',
    'compass',
    '#22c55e',
    TRUE
  )
  RETURNING id INTO v_template_id;

  -- 1. Заключение договора
  INSERT INTO template_stages (template_id, name, stage_key, order_index)
    VALUES (v_template_id, 'Заключение договора', 'contract', 1)
    RETURNING id INTO v_stage_id;
  INSERT INTO template_checklist_items (template_stage_id, label, order_index) VALUES
    (v_stage_id, 'Подписание договора с заказчиком', 1);

  -- 2. Изыскательные работы
  INSERT INTO template_stages (template_id, name, stage_key, order_index)
    VALUES (v_template_id, 'Изыскательные работы', 'surveys', 2)
    RETURNING id INTO v_stage_id;
  INSERT INTO template_checklist_items (template_stage_id, label, order_index) VALUES
    (v_stage_id, 'Геодезия', 1),
    (v_stage_id, 'Геология', 2);

  -- 3. Получение исходных данных
  INSERT INTO template_stages (template_id, name, stage_key, order_index)
    VALUES (v_template_id, 'Получение исходных данных', 'initial_data', 3)
    RETURNING id INTO v_stage_id;
  INSERT INTO template_checklist_items (template_stage_id, label, order_index) VALUES
    (v_stage_id, 'Правоустанавливающие документы на землю и собственность', 1),
    (v_stage_id, 'Технические условия на подключение к сетям', 2),
    (v_stage_id, 'АПЗ (Архитектурно-планировочное задание)', 3),
    (v_stage_id, 'Аэронавигационные данные', 4),
    (v_stage_id, 'Эскизный проект', 5),
    (v_stage_id, 'Протокол радон', 6),
    (v_stage_id, 'Протокол дозиметра', 7);

  -- 4. Разработка ПСД
  INSERT INTO template_stages (template_id, name, stage_key, order_index)
    VALUES (v_template_id, 'Разработка ПСД', 'psd', 4)
    RETURNING id INTO v_stage_id;
  INSERT INTO template_checklist_items (template_stage_id, label, order_index) VALUES
    (v_stage_id, 'Проектная документация', 1),
    (v_stage_id, 'Сметная документация', 2);

  -- 5. Согласование проекта
  INSERT INTO template_stages (template_id, name, stage_key, order_index)
    VALUES (v_template_id, 'Согласование проекта', 'approval', 5)
    RETURNING id INTO v_stage_id;
  INSERT INTO template_checklist_items (template_stage_id, label, order_index) VALUES
    (v_stage_id, 'Согласование с заказчиком', 1),
    (v_stage_id, 'Согласование с владельцами сетей (по каждому ТУ)', 2);

  -- 6. Разработка ОВОС
  INSERT INTO template_stages (template_id, name, stage_key, order_index)
    VALUES (v_template_id, 'Разработка ОВОС', 'ovos', 6)
    RETURNING id INTO v_stage_id;
  INSERT INTO template_checklist_items (template_stage_id, label, order_index) VALUES
    (v_stage_id, 'Оценка влияния на окружающую среду', 1);

  -- 7. Государственная экспертиза
  INSERT INTO template_stages (template_id, name, stage_key, order_index)
    VALUES (v_template_id, 'Государственная экспертиза', 'expertise', 7)
    RETURNING id INTO v_stage_id;
  INSERT INTO template_checklist_items (template_stage_id, label, order_index) VALUES
    (v_stage_id, 'Загрузка документации на портал Госэкспертизы', 1),
    (v_stage_id, 'Комплектация пакета документов', 2),
    (v_stage_id, 'Заключение договора с Госэкспертизой', 3),
    (v_stage_id, 'Начало экспертизы', 4),
    (v_stage_id, 'Завершение экспертизы — получение заключения', 5);

  -- 8. Выдача ПСД заказчику
  INSERT INTO template_stages (template_id, name, stage_key, order_index)
    VALUES (v_template_id, 'Выдача окончательной версии ПСД', 'final_delivery', 8)
    RETURNING id INTO v_stage_id;
  INSERT INTO template_checklist_items (template_stage_id, label, order_index) VALUES
    (v_stage_id, 'Финальная передача ПСД заказчику', 1);

  -- Привязываем все существующие проекты к default-шаблону
  UPDATE projects SET template_id = v_template_id WHERE template_id IS NULL;
END $$;

-- ── 3. Backward-compat: create_design_stages теперь wrapper ───────────────
-- Старый код может вызывать create_design_stages напрямую. Переписываем
-- функцию так, чтобы она находила default-шаблон и делегировала туда.
CREATE OR REPLACE FUNCTION create_design_stages(p_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_template_id UUID;
BEGIN
  SELECT id INTO v_template_id
    FROM project_templates
   WHERE is_default = TRUE
   LIMIT 1;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Нет default-шаблона. Создайте хотя бы один шаблон в /dashboard/settings/templates.';
  END IF;

  PERFORM create_project_from_template(p_project_id, v_template_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_design_stages(UUID) TO authenticated;
