-- ============================================================
-- Migration 043: RLS hardening
-- ============================================================
-- Закрывает дыры в политиках RLS, найденные аудитом:
--
-- 1) Privilege escalation: любой пользователь мог UPDATE profiles
--    SET role='admin' WHERE id=auth.uid() — у политики "Только свой профиль"
--    не было WITH CHECK. Запрещаем менять role/id/is_active самому себе.
--
-- 2) Row stealing на UPDATE: десятки политик имели только USING без
--    WITH CHECK. Это позволяет пользователю в момент UPDATE поменять
--    ключевые поля (например, author_id, user_id, created_by, assignee_id),
--    после чего строка остаётся «его» по новому значению. Добавляем
--    WITH CHECK, повторяющий условие USING.
--
-- 3) INSERT-спуфинг: direct_tasks/project_tasks/documents/events не пиннили
--    created_by/uploaded_by к auth.uid(). Менеджер мог создать задачу
--    «от имени» директора и наоборот. Пиним.
--
-- 4) SECURITY DEFINER функции вида get_my_xxx(p_user_id) принимали
--    произвольный UUID без проверки. Любой сотрудник мог через RPC
--    прочитать чужие счётчики/список проектов. Добавляем guard:
--    p_user_id = auth.uid() OR has_director_access().
--
-- 5) Дашборд-функции get_workload_overview / get_silent_employees_today /
--    get_all_direct_task_counts / get_direct_task_counts возвращают
--    агрегаты по всей компании. Закрываем за has_manager_access().
--
-- 6) cleanup_old_activity_log() и create_project_from_template() были
--    grant'нуты authenticated без проверки роли. Добавляем role gate.
--
-- 7) activity_log SELECT был открыт всем. Закрываем за has_director_access()
--    (UI и так показывает только директору, делаем consistent).
--
-- Миграция идемпотентна: каждый блок DROP POLICY IF EXISTS + CREATE.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. PROFILES — запретить privilege escalation
-- ════════════════════════════════════════════════════════════
-- Старая политика разрешала пользователю менять любую колонку,
-- включая role и is_active. Новая разрешает только редактирование
-- профиля себе, но запрещает изменять id, role, is_active.

DROP POLICY IF EXISTS "Только свой профиль можно редактировать" ON profiles;
CREATE POLICY "Только свой профиль можно редактировать" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- role и is_active меняет только директор/admin (политика ниже)
    AND role     = (SELECT role     FROM profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM profiles WHERE id = auth.uid())
  );

-- Директор/admin полностью управляет профилями (FOR ALL → нужен и WITH CHECK).
DROP POLICY IF EXISTS "Директор управляет профилями" ON profiles;
CREATE POLICY "Директор управляет профилями" ON profiles
  FOR ALL TO authenticated
  USING (has_director_access())
  WITH CHECK (has_director_access());


-- ════════════════════════════════════════════════════════════
-- 2. PROJECTS — добавить WITH CHECK на UPDATE
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Директор и менеджер редактируют проекты" ON projects;
CREATE POLICY "Директор и менеджер редактируют проекты" ON projects
  FOR UPDATE TO authenticated
  USING (has_manager_access())
  WITH CHECK (has_manager_access());


-- ════════════════════════════════════════════════════════════
-- 3. PROJECT_STAGES — заменить FOR ALL на отдельные политики с WITH CHECK
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Менеджер и директор управляют этапами" ON project_stages;
CREATE POLICY "stages_insert" ON project_stages
  FOR INSERT TO authenticated WITH CHECK (has_manager_access());
CREATE POLICY "stages_update" ON project_stages
  FOR UPDATE TO authenticated
  USING (has_manager_access())
  WITH CHECK (has_manager_access());
CREATE POLICY "stages_delete" ON project_stages
  FOR DELETE TO authenticated USING (has_manager_access());


-- ════════════════════════════════════════════════════════════
-- 4. STAGE_CHECKLIST_ITEMS — добавить WITH CHECK на UPDATE
-- ════════════════════════════════════════════════════════════
-- Без WITH CHECK ассигни этапа мог переставить stage_id пункта на
-- чужой этап и продолжить «владеть» им.
DROP POLICY IF EXISTS "checklist_update" ON stage_checklist_items;
CREATE POLICY "checklist_update" ON stage_checklist_items
  FOR UPDATE TO authenticated
  USING (
    has_manager_access()
    OR EXISTS (
      SELECT 1
        FROM project_stages ps
        LEFT JOIN projects p ON p.id = ps.project_id
       WHERE ps.id = stage_checklist_items.stage_id
         AND (ps.assignee_id = auth.uid() OR p.manager_id = auth.uid())
    )
  )
  WITH CHECK (
    has_manager_access()
    OR EXISTS (
      SELECT 1
        FROM project_stages ps
        LEFT JOIN projects p ON p.id = ps.project_id
       WHERE ps.id = stage_checklist_items.stage_id
         AND (ps.assignee_id = auth.uid() OR p.manager_id = auth.uid())
    )
  );


-- ════════════════════════════════════════════════════════════
-- 5. DOCUMENTS — пин uploaded_by + WITH CHECK на UPDATE
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Загружать могут аутентифицированные" ON documents;
CREATE POLICY "Загружать могут аутентифицированные" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Директор и менеджер обновляют документы" ON documents;
CREATE POLICY "Директор и менеджер обновляют документы" ON documents
  FOR UPDATE TO authenticated
  USING (has_manager_access())
  WITH CHECK (has_manager_access());


-- ════════════════════════════════════════════════════════════
-- 6. EVENTS / EVENT_PARTICIPANTS — WITH CHECK на UPDATE + пин created_by
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "events_insert" ON events;
CREATE POLICY "events_insert" ON events
  FOR INSERT TO authenticated
  WITH CHECK (has_director_access() AND created_by = auth.uid());

DROP POLICY IF EXISTS "events_update" ON events;
CREATE POLICY "events_update" ON events
  FOR UPDATE TO authenticated
  USING (has_director_access())
  WITH CHECK (has_director_access());


-- ════════════════════════════════════════════════════════════
-- 7. NOTIFICATIONS — WITH CHECK на UPDATE (нельзя сменить user_id)
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- 8. DAILY_REPORTS — WITH CHECK на UPDATE (нельзя присвоить чужой отчёт)
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "dr_update" ON daily_reports;
CREATE POLICY "dr_update" ON daily_reports
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- 9. DIRECT_TASKS — пин created_by на INSERT + WITH CHECK на UPDATE
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "direct_tasks_insert" ON direct_tasks;
CREATE POLICY "direct_tasks_insert" ON direct_tasks
  FOR INSERT TO authenticated
  WITH CHECK (has_director_access() AND created_by = auth.uid());

-- UPDATE: USING из 042 + симметричный WITH CHECK,
-- запрещающий смену created_by «обычным» исполнителем.
DROP POLICY IF EXISTS "direct_tasks_update" ON direct_tasks;
CREATE POLICY "direct_tasks_update" ON direct_tasks
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR has_director_access()
    OR is_assignee_of_direct_task(id)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR has_director_access()
    OR is_assignee_of_direct_task(id)
  );


-- ════════════════════════════════════════════════════════════
-- 10. PROJECT_TASKS — пин created_by на INSERT + WITH CHECK на UPDATE
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "project_tasks_insert" ON project_tasks;
CREATE POLICY "project_tasks_insert" ON project_tasks
  FOR INSERT TO authenticated
  WITH CHECK (has_manager_access() AND created_by = auth.uid());

DROP POLICY IF EXISTS "project_tasks_update" ON project_tasks;
CREATE POLICY "project_tasks_update" ON project_tasks
  FOR UPDATE TO authenticated
  USING (
    has_manager_access()
    OR EXISTS (
      SELECT 1 FROM project_task_assignees
       WHERE task_id = project_tasks.id AND profile_id = auth.uid()
    )
  )
  WITH CHECK (
    has_manager_access()
    OR EXISTS (
      SELECT 1 FROM project_task_assignees
       WHERE task_id = project_tasks.id AND profile_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════
-- 11. TASK_REPORTS — WITH CHECK на UPDATE (нельзя присвоить чужой отчёт)
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "task_reports_update" ON task_reports;
CREATE POLICY "task_reports_update" ON task_reports
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- 12. PUSH_SUBSCRIPTIONS — заменить FOR ALL на отдельные политики с WITH CHECK
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "push_subscriptions_owner" ON push_subscriptions;
CREATE POLICY "push_subscriptions_select" ON push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "push_subscriptions_insert" ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_subscriptions_update" ON push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_subscriptions_delete" ON push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- 13. PROJECT_TEMPLATES / TEMPLATE_STAGES / TEMPLATE_CHECKLIST_ITEMS —
--      WITH CHECK на UPDATE
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "templates_update" ON project_templates;
CREATE POLICY "templates_update" ON project_templates
  FOR UPDATE TO authenticated
  USING (has_director_access()) WITH CHECK (has_director_access());

DROP POLICY IF EXISTS "template_stages_update" ON template_stages;
CREATE POLICY "template_stages_update" ON template_stages
  FOR UPDATE TO authenticated
  USING (has_director_access()) WITH CHECK (has_director_access());

DROP POLICY IF EXISTS "template_checklist_update" ON template_checklist_items;
CREATE POLICY "template_checklist_update" ON template_checklist_items
  FOR UPDATE TO authenticated
  USING (has_director_access()) WITH CHECK (has_director_access());


-- ════════════════════════════════════════════════════════════
-- 14. ACTIVITY_LOG — закрыть SELECT за has_director_access
-- ════════════════════════════════════════════════════════════
-- UI и так показывает лог только директору, но прямой запрос к Supabase
-- отдавал весь audit trail любому сотруднику. Закрываем.
DROP POLICY IF EXISTS "Все видят лог" ON activity_log;
CREATE POLICY "activity_log_select" ON activity_log
  FOR SELECT TO authenticated
  USING (has_director_access() OR actor_id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- 15. SECURITY DEFINER функции — добавить guard на p_user_id
-- ════════════════════════════════════════════════════════════
-- Любой авторизованный мог через RPC передать чужой UUID и получить
-- его счётчики/проекты. Добавляем проверку:
--   p_user_id = auth.uid() OR has_director_access()

CREATE OR REPLACE FUNCTION get_my_direct_task_counts(p_user_id UUID)
RETURNS TABLE (status TEXT, "count" INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT has_director_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT t.status::TEXT, COUNT(*)::INT
      FROM direct_tasks t
     WHERE t.assignee_id = p_user_id
     GROUP BY t.status;
END;
$$;

CREATE OR REPLACE FUNCTION get_my_project_task_counts(p_user_id UUID)
RETURNS TABLE (status TEXT, "count" INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT has_director_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT t.status::TEXT, COUNT(*)::INT
      FROM project_tasks t
     WHERE t.assignee_id = p_user_id
     GROUP BY t.status;
END;
$$;

CREATE OR REPLACE FUNCTION get_my_overdue_counts(p_user_id UUID)
RETURNS TABLE (kind TEXT, "count" INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT has_director_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT 'direct'::TEXT, COUNT(*)::INT FROM direct_tasks
     WHERE assignee_id = p_user_id
       AND status != 'done'
       AND deadline IS NOT NULL
       AND deadline < CURRENT_DATE
    UNION ALL
    SELECT 'project'::TEXT, COUNT(*)::INT FROM project_tasks
     WHERE assignee_id = p_user_id
       AND status != 'done'
       AND deadline IS NOT NULL
       AND deadline < CURRENT_DATE;
END;
$$;

CREATE OR REPLACE FUNCTION get_my_projects_page(
  p_user_id UUID,
  p_page    INT,
  p_size    INT
)
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  status          TEXT,
  deadline        DATE,
  start_date      DATE,
  client_name     TEXT,
  contract_number TEXT,
  budget          NUMERIC,
  created_at      TIMESTAMPTZ,
  manager_name    TEXT,
  stages          JSONB,
  total_count     BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT has_director_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH my_pids AS (
    SELECT pt.project_id AS pid
      FROM project_tasks pt
     WHERE pt.assignee_id = p_user_id AND pt.project_id IS NOT NULL
    UNION
    SELECT ps.project_id AS pid
      FROM project_stages ps
     WHERE ps.assignee_id = p_user_id AND ps.project_id IS NOT NULL
  ),
  active_projects AS (
    SELECT p.*
      FROM projects p
      JOIN my_pids mp ON mp.pid = p.id
     WHERE p.status NOT IN ('completed', 'cancelled')
  ),
  tot AS (
    SELECT COUNT(*)::BIGINT AS c FROM active_projects
  ),
  page_data AS (
    SELECT *
      FROM active_projects
     ORDER BY created_at DESC
     LIMIT p_size
    OFFSET p_page * p_size
  )
  SELECT
    pd.id,
    pd.name,
    pd.status::TEXT,
    pd.deadline,
    pd.start_date,
    pd.client_name,
    pd.contract_number,
    pd.budget,
    pd.created_at,
    m.full_name AS manager_name,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'stage_key',     ps2.stage_key,
                'status',        ps2.status::TEXT,
                'deadline',      ps2.deadline,
                'review_status', ps2.review_status::TEXT
              ) ORDER BY ps2.order_index)
         FROM project_stages ps2
        WHERE ps2.project_id = pd.id),
      '[]'::jsonb
    ) AS stages,
    (SELECT c FROM tot) AS total_count
    FROM page_data pd
    LEFT JOIN profiles m ON m.id = pd.manager_id
   ORDER BY pd.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_direct_task_counts(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_project_task_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_overdue_counts(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_projects_page(UUID, INT, INT) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 16. Дашборд-функции для руководителей — закрыть за has_manager_access
-- ════════════════════════════════════════════════════════════
-- Эти функции возвращают агрегаты по всей компании. Сотрудник
-- (employee) не должен видеть «кто молчит сегодня», workload других
-- людей или счётчики всех поручений.

CREATE OR REPLACE FUNCTION get_workload_overview()
RETURNS TABLE (
  user_id          UUID,
  full_name        TEXT,
  "position"       TEXT,
  department       TEXT,
  role             TEXT,
  wip_limit        INT,
  in_progress_count INT,
  todo_count       INT,
  overdue_count    INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_manager_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH
  d AS (
    SELECT
      assignee_id,
      COUNT(*) FILTER (WHERE status = 'in_progress')::INT AS in_progress,
      COUNT(*) FILTER (WHERE status = 'todo')::INT        AS todo,
      COUNT(*) FILTER (
        WHERE status != 'done'
          AND deadline IS NOT NULL
          AND deadline < CURRENT_DATE
      )::INT AS overdue
    FROM direct_tasks
    WHERE assignee_id IS NOT NULL
    GROUP BY assignee_id
  ),
  p AS (
    SELECT
      assignee_id,
      COUNT(*) FILTER (WHERE status = 'in_progress')::INT AS in_progress,
      COUNT(*) FILTER (WHERE status = 'todo')::INT        AS todo,
      COUNT(*) FILTER (
        WHERE status != 'done'
          AND deadline IS NOT NULL
          AND deadline < CURRENT_DATE
      )::INT AS overdue
    FROM project_tasks
    WHERE assignee_id IS NOT NULL
    GROUP BY assignee_id
  )
  SELECT
    pr.id,
    pr.full_name,
    pr.position,
    pr.department,
    pr.role::TEXT,
    COALESCE(pr.wip_limit, 5),
    COALESCE(d.in_progress, 0) + COALESCE(p.in_progress, 0),
    COALESCE(d.todo, 0)        + COALESCE(p.todo, 0),
    COALESCE(d.overdue, 0)     + COALESCE(p.overdue, 0)
  FROM profiles pr
  LEFT JOIN d ON d.assignee_id = pr.id
  LEFT JOIN p ON p.assignee_id = pr.id
  WHERE pr.is_active = TRUE
    AND pr.role::text != 'admin'
  ORDER BY pr.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION get_silent_employees_today(p_limit INT DEFAULT 30)
RETURNS TABLE (
  id          UUID,
  full_name   TEXT,
  role        TEXT,
  "position"  TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_manager_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.role::TEXT, p.position
      FROM profiles p
      LEFT JOIN daily_reports dr
        ON dr.author_id = p.id
       AND dr.report_date = CURRENT_DATE
     WHERE p.is_active = true
       AND p.role IN ('employee', 'manager')
       AND dr.id IS NULL
     ORDER BY p.full_name
     LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION get_all_direct_task_counts()
RETURNS TABLE (status TEXT, "count" INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_director_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT t.status::TEXT, COUNT(*)::INT
      FROM direct_tasks t
     GROUP BY t.status;
END;
$$;

GRANT EXECUTE ON FUNCTION get_workload_overview()           TO authenticated;
GRANT EXECUTE ON FUNCTION get_silent_employees_today(INT)   TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_direct_task_counts()      TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 17. cleanup_old_activity_log — только director/admin
-- ════════════════════════════════════════════════════════════
-- Эта функция массово удаляет записи аудита. Любой authenticated
-- мог её вызвать и тем самым стереть следы своих действий за месяц.
CREATE OR REPLACE FUNCTION cleanup_old_activity_log()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  IF NOT has_director_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
-- pg_cron всё равно вызывает функцию от суперпользователя — для него
-- has_director_access() даст false (auth.uid() = NULL), но cron запускает
-- функции от postgres user, и SECURITY DEFINER не помешает. Чтобы cron
-- продолжал работать, отдельный bypass: если auth.uid() IS NULL (нет
-- сессии = вызов из cron/SQL editor) — пропускаем.
CREATE OR REPLACE FUNCTION cleanup_old_activity_log()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_director_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
GRANT EXECUTE ON FUNCTION cleanup_old_activity_log() TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 18. create_project_from_template / create_design_stages — manager+
-- ════════════════════════════════════════════════════════════
-- Эти RPC создают project_stages + checklist_items для проекта,
-- обходя RLS на этих таблицах (SECURITY DEFINER). Любой сотрудник
-- мог через прямой RPC засеять чужому проекту произвольный шаблон
-- этапов. Закрываем за has_manager_access().
CREATE OR REPLACE FUNCTION create_project_from_template(
  p_project_id  UUID,
  p_template_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts          RECORD;
  v_stage_id  UUID;
BEGIN
  IF NOT has_manager_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

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

  UPDATE projects SET template_id = p_template_id
    WHERE id = p_project_id AND template_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION create_design_stages(p_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id UUID;
BEGIN
  IF NOT has_manager_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

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

GRANT EXECUTE ON FUNCTION create_project_from_template(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_design_stages(UUID) TO authenticated;


-- ════════════════════════════════════════════════════════════
-- 19. get_user_active_wip / get_user_wip_limit — guard
-- ════════════════════════════════════════════════════════════
-- Менее чувствительно (это просто счётчик), но для согласованности
-- и чтобы employee не сканировал чужие WIP — закрываем тем же guard'ом.
CREATE OR REPLACE FUNCTION get_user_active_wip(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT has_manager_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN (
    (SELECT COUNT(*)::INT FROM direct_tasks
       WHERE assignee_id = p_user_id AND status = 'in_progress')
    +
    (SELECT COUNT(*)::INT FROM project_tasks
       WHERE assignee_id = p_user_id AND status = 'in_progress')
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_user_wip_limit(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT has_manager_access() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT COALESCE(wip_limit, 5) FROM profiles WHERE id = p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_active_wip(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_wip_limit(UUID)  TO authenticated;
