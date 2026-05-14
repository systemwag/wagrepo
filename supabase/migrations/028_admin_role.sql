-- ============================================================
-- Migration 028: суперроль admin
-- ============================================================
-- Admin — настоящая отдельная роль в БД, выше director. Имеет все
-- доступы director плюс служебные функции (тестовые модули, dev-фичи).
--
-- Все существующие RLS-политики, ранее ссылавшиеся на 'director' или
-- ('director', 'manager'), переписаны через хелперы has_director_access()
-- и has_manager_access(), которые включают admin.
--
-- Назначение конкретного пользователя в роль admin — в отдельной
-- миграции 029_set_admin_user.sql (ALTER TYPE ADD VALUE и UPDATE по
-- новому значению должны быть в разных транзакциях).
-- ============================================================

-- ── 1. Расширяем enum user_role ──────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'admin'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'admin';
  END IF;
END $$;

-- ── 2. Хелперы доступа ────────────────────────────────────────────────────
-- Сравнение через role::text — чтобы не натолкнуться на ограничение
-- Postgres «новое значение enum нельзя использовать в той же транзакции».

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role::text = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION has_director_access()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role::text IN ('director', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION has_manager_access()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role::text IN ('director', 'manager', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin()             TO authenticated;
GRANT EXECUTE ON FUNCTION has_director_access()  TO authenticated;
GRANT EXECUTE ON FUNCTION has_manager_access()   TO authenticated;

-- ── 3. PROFILES ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Директор управляет профилями" ON profiles;
CREATE POLICY "Директор управляет профилями" ON profiles FOR ALL
  USING (has_director_access());

-- ── 4. PROJECTS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Директор и менеджер создают проекты" ON projects;
CREATE POLICY "Директор и менеджер создают проекты" ON projects FOR INSERT
  WITH CHECK (has_manager_access());

DROP POLICY IF EXISTS "Директор и менеджер редактируют проекты" ON projects;
CREATE POLICY "Директор и менеджер редактируют проекты" ON projects FOR UPDATE
  USING (has_manager_access());

DROP POLICY IF EXISTS "Только директор удаляет проекты" ON projects;
CREATE POLICY "Только директор удаляет проекты" ON projects FOR DELETE
  USING (has_director_access());

-- ── 5. PROJECT_STAGES ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Менеджер и директор управляют этапами" ON project_stages;
CREATE POLICY "Менеджер и директор управляют этапами" ON project_stages FOR ALL
  USING (has_manager_access());

-- ── 6. STAGE_CHECKLIST_ITEMS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "checklist_insert" ON stage_checklist_items;
CREATE POLICY "checklist_insert" ON stage_checklist_items FOR INSERT TO authenticated
  WITH CHECK (has_manager_access());

DROP POLICY IF EXISTS "checklist_delete" ON stage_checklist_items;
CREATE POLICY "checklist_delete" ON stage_checklist_items FOR DELETE TO authenticated
  USING (has_manager_access());

DROP POLICY IF EXISTS "checklist_update" ON stage_checklist_items;
CREATE POLICY "checklist_update" ON stage_checklist_items FOR UPDATE TO authenticated
  USING (
    has_manager_access()
    OR EXISTS (
      SELECT 1
        FROM project_stages ps
        LEFT JOIN projects p ON p.id = ps.project_id
       WHERE ps.id = stage_checklist_items.stage_id
         AND (ps.assignee_id = auth.uid() OR p.manager_id = auth.uid())
    )
  );

-- ── 7. DOCUMENTS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Директор и менеджер обновляют документы" ON documents;
CREATE POLICY "Директор и менеджер обновляют документы" ON documents FOR UPDATE
  USING (has_manager_access());

DROP POLICY IF EXISTS "Директор и менеджер удаляют документы" ON documents;
DROP POLICY IF EXISTS "Директор удаляет документы" ON documents;
CREATE POLICY "Директор и менеджер удаляют документы" ON documents FOR DELETE
  USING (has_manager_access());

-- ── 8. DIRECT_TASKS (миграция 026) ────────────────────────────────────────
DROP POLICY IF EXISTS "direct_tasks_select" ON direct_tasks;
CREATE POLICY "direct_tasks_select" ON direct_tasks FOR SELECT TO authenticated USING (
  assignee_id = auth.uid()
  OR created_by = auth.uid()
  OR has_director_access()
);

DROP POLICY IF EXISTS "direct_tasks_insert" ON direct_tasks;
CREATE POLICY "direct_tasks_insert" ON direct_tasks FOR INSERT TO authenticated WITH CHECK (
  has_director_access()
);

DROP POLICY IF EXISTS "direct_tasks_update" ON direct_tasks;
CREATE POLICY "direct_tasks_update" ON direct_tasks FOR UPDATE TO authenticated USING (
  assignee_id = auth.uid()
  OR created_by = auth.uid()
  OR has_director_access()
);

DROP POLICY IF EXISTS "direct_tasks_delete" ON direct_tasks;
CREATE POLICY "direct_tasks_delete" ON direct_tasks FOR DELETE TO authenticated USING (
  has_director_access()
);

-- ── 9. PROJECT_TASKS (миграция 026) ───────────────────────────────────────
DROP POLICY IF EXISTS "project_tasks_insert" ON project_tasks;
CREATE POLICY "project_tasks_insert" ON project_tasks FOR INSERT TO authenticated WITH CHECK (
  has_manager_access()
);

DROP POLICY IF EXISTS "project_tasks_update" ON project_tasks;
CREATE POLICY "project_tasks_update" ON project_tasks FOR UPDATE TO authenticated USING (
  has_manager_access()
  OR assignee_id = auth.uid()
);

DROP POLICY IF EXISTS "project_tasks_delete" ON project_tasks;
CREATE POLICY "project_tasks_delete" ON project_tasks FOR DELETE TO authenticated USING (
  has_manager_access()
);

-- ── 10. TASK_REPORTS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "task_reports_delete" ON task_reports;
CREATE POLICY "task_reports_delete" ON task_reports FOR DELETE TO authenticated
  USING (has_director_access());

-- ── 11. ACTIVITY_LOG (миграция 027) ───────────────────────────────────────
DROP POLICY IF EXISTS "activity_log_delete" ON activity_log;
CREATE POLICY "activity_log_delete" ON activity_log FOR DELETE TO authenticated
  USING (has_director_access());
