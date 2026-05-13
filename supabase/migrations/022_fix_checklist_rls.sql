-- ============================================================
-- 022: Закрыть RLS на stage_checklist_items
-- ============================================================
-- Проблема: политика "Все сотрудники отмечают пункты" из миграции 002
-- использовала USING (TRUE) — любой авторизованный пользователь мог
-- редактировать любой чек-лист любого этапа любого проекта.
--
-- Решение: разрешить UPDATE только:
--   - директору и менеджеру (полный доступ),
--   - назначенному ответственному за этап (assignee_id),
--   - менеджеру проекта, к которому относится этап.
-- ============================================================

DROP POLICY IF EXISTS "Все сотрудники отмечают пункты" ON stage_checklist_items;
DROP POLICY IF EXISTS "Директор и менеджер управляют чек-листами" ON stage_checklist_items;

-- SELECT: видят все авторизованные (как было)
DROP POLICY IF EXISTS "Все видят чек-листы" ON stage_checklist_items;
CREATE POLICY "checklist_select" ON stage_checklist_items
  FOR SELECT TO authenticated
  USING (TRUE);

-- INSERT/DELETE: только директор и менеджер
CREATE POLICY "checklist_insert" ON stage_checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('director', 'manager'));

CREATE POLICY "checklist_delete" ON stage_checklist_items
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('director', 'manager'));

-- UPDATE: директор/менеджер ИЛИ ответственный за этап ИЛИ менеджер проекта
CREATE POLICY "checklist_update" ON stage_checklist_items
  FOR UPDATE TO authenticated
  USING (
    get_my_role() IN ('director', 'manager')
    OR EXISTS (
      SELECT 1
        FROM project_stages ps
        LEFT JOIN projects p ON p.id = ps.project_id
       WHERE ps.id = stage_checklist_items.stage_id
         AND (
           ps.assignee_id = auth.uid()
           OR p.manager_id = auth.uid()
         )
    )
  );
