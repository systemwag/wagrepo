-- ============================================================
-- Migration 066: единый RPC для «Светофора дедлайнов»
-- ============================================================
-- Цель: страница /dashboard/deadlines делала 3 параллельных PostgREST
-- запроса и считала всё на сервере вручную. При этом:
--   * проекты/задачи БЕЗ дедлайна молча выпадали из светофора —
--     директор не видел проблему планирования;
--   * пункты чек-листа с дедлайнами (миграция 065) не учитывались;
--   * показывался только legacy assignee_id, без junction-ассигни
--     (миграции 039 + 065).
--
-- Эта функция собирает всё в одной выборке: поручения + задачи проектов
-- + пункты чек-листа + проекты. Возвращает массив ассигни (jsonb) с учётом
-- junction-таблиц + fallback на legacy assignee_id для совместимости.
-- Сущности БЕЗ deadline тоже возвращаются — UI рендерит их в отдельную
-- колонку «Без срока».
--
-- Доступ: только director (RLS поверх таблиц уже разрешает директору
-- читать всё, но проверяем явно в SECURITY DEFINER, чтобы не утечь
-- лишнее в случае ошибки в политиках).
--
-- Идемпотентна (DROP FUNCTION IF EXISTS + CREATE).
-- ============================================================

DROP FUNCTION IF EXISTS get_deadlines_board();

CREATE OR REPLACE FUNCTION get_deadlines_board()
RETURNS TABLE (
  source        TEXT,
  source_id     UUID,
  title         TEXT,
  project_id    UUID,
  project_name  TEXT,
  stage_id      UUID,
  deadline      DATE,
  status        TEXT,
  assignees     JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_director_access() THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- ─── Поручения ─────────────────────────────────────────────────────
  SELECT
    'direct_task'::TEXT                                  AS source,
    dt.id                                                AS source_id,
    dt.title                                             AS title,
    NULL::UUID                                           AS project_id,
    NULL::TEXT                                           AS project_name,
    NULL::UUID                                           AS stage_id,
    dt.deadline                                          AS deadline,
    dt.status::TEXT                                      AS status,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name) ORDER BY p.full_name)
         FROM direct_task_assignees dta
         JOIN profiles p ON p.id = dta.profile_id
        WHERE dta.task_id = dt.id),
      CASE
        WHEN dt.assignee_id IS NOT NULL THEN
          (SELECT jsonb_build_array(jsonb_build_object('id', p.id, 'full_name', p.full_name))
             FROM profiles p WHERE p.id = dt.assignee_id)
        ELSE '[]'::jsonb
      END
    )                                                    AS assignees
  FROM direct_tasks dt
  WHERE dt.status NOT IN ('done', 'failed')

  UNION ALL

  -- ─── Задачи проектов ───────────────────────────────────────────────
  SELECT
    'project_task'::TEXT,
    pt.id,
    pt.title,
    pt.project_id,
    pr.name,
    pt.stage_id,
    pt.deadline,
    pt.status::TEXT,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name) ORDER BY p.full_name)
         FROM project_task_assignees pta
         JOIN profiles p ON p.id = pta.profile_id
        WHERE pta.task_id = pt.id),
      CASE
        WHEN pt.assignee_id IS NOT NULL THEN
          (SELECT jsonb_build_array(jsonb_build_object('id', p.id, 'full_name', p.full_name))
             FROM profiles p WHERE p.id = pt.assignee_id)
        ELSE '[]'::jsonb
      END
    )
  FROM project_tasks pt
  LEFT JOIN projects pr ON pr.id = pt.project_id
  WHERE pt.status NOT IN ('done', 'failed')

  UNION ALL

  -- ─── Пункты чек-листа с дедлайнами (миграция 065) ─────────────────
  -- Включаем все незакрытые: и с deadline, и без — без срока
  -- тоже информативно (директор видит, что у этапа есть «висящие» пункты).
  SELECT
    'checklist'::TEXT,
    ci.id,
    ci.label,
    ps.project_id,
    pr.name,
    ci.stage_id,
    ci.deadline,
    CASE WHEN ci.is_completed THEN 'done' ELSE 'todo' END,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name) ORDER BY p.full_name)
         FROM stage_checklist_item_assignees a
         JOIN profiles p ON p.id = a.profile_id
        WHERE a.item_id = ci.id),
      '[]'::jsonb
    )
  FROM stage_checklist_items ci
  JOIN project_stages ps ON ps.id = ci.stage_id
  LEFT JOIN projects pr ON pr.id = ps.project_id
  WHERE ci.is_completed = FALSE
    AND ci.deadline IS NOT NULL   -- без срока чек-лист не шумит в светофор
    AND pr.status NOT IN ('completed', 'cancelled')

  UNION ALL

  -- ─── Проекты целиком ───────────────────────────────────────────────
  SELECT
    'project'::TEXT,
    pr.id,
    pr.name,
    pr.id,
    pr.name,
    NULL::UUID,
    pr.deadline,
    pr.status::TEXT,
    CASE
      WHEN pr.manager_id IS NOT NULL THEN
        (SELECT jsonb_build_array(jsonb_build_object('id', p.id, 'full_name', p.full_name))
           FROM profiles p WHERE p.id = pr.manager_id)
      ELSE '[]'::jsonb
    END
  FROM projects pr
  WHERE pr.status NOT IN ('completed', 'cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION get_deadlines_board() TO authenticated;
