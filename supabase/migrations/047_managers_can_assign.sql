-- ============================================================
-- Migration 047: менеджеры могут отправлять прямые поручения
-- ============================================================
-- Раньше создание direct_tasks было закрыто за has_director_access().
-- Это создавало бутылочное горлышко: менеджер проекта не мог попросить
-- сотрудника отвезти акты или передать тендер другому менеджеру.
-- Расширяем до has_manager_access() (manager + director + admin).
--
-- Сотрудники (employee) НЕ получают права создавать — иначе фича
-- превратится в чат. Они только принимают/отвечают.
--
-- DELETE: расширяем так, чтобы менеджер удалял ТОЛЬКО свои поручения,
-- а директор+ — любые (для модерации). Раньше было только директор.
-- ============================================================

-- ── 1. direct_tasks INSERT ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "direct_tasks_insert" ON direct_tasks;
CREATE POLICY "direct_tasks_insert" ON direct_tasks
  FOR INSERT TO authenticated
  WITH CHECK (has_manager_access() AND created_by = auth.uid());

-- ── 2. direct_tasks DELETE ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "direct_tasks_delete" ON direct_tasks;
CREATE POLICY "direct_tasks_delete" ON direct_tasks FOR DELETE TO authenticated USING (
  has_director_access() OR created_by = auth.uid()
);

-- ── 3. direct_task_assignees INSERT/DELETE ─────────────────────────────────
-- Junction должен позволять менеджеру добавлять/убирать исполнителей
-- (либо в форме создания, либо позже через setDirectTaskAssignees).
DROP POLICY IF EXISTS "dtask_assignees_insert" ON direct_task_assignees;
CREATE POLICY "dtask_assignees_insert" ON direct_task_assignees
  FOR INSERT TO authenticated WITH CHECK (has_manager_access());

DROP POLICY IF EXISTS "dtask_assignees_delete" ON direct_task_assignees;
CREATE POLICY "dtask_assignees_delete" ON direct_task_assignees
  FOR DELETE TO authenticated USING (has_manager_access());

-- direct_tasks_update из миграций 042+043 уже корректен:
-- USING (created_by = auth.uid() OR has_director_access() OR is_assignee_of_direct_task(id))
-- — автор-менеджер уже может править свои, не трогаем.
