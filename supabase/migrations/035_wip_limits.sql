-- ============================================================
-- Migration 031: WIP-лимит для сотрудников
-- ============================================================
-- Каждый сотрудник имеет «лимит работы в процессе» (Work In Progress) —
-- сколько задач может одновременно быть в статусе 'in_progress'.
-- По умолчанию 5. Лимит мягкий — превышение даёт предупреждение,
-- но не блокирует (директор и admin могут пробить).
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS wip_limit INT NOT NULL DEFAULT 5;

COMMENT ON COLUMN profiles.wip_limit IS
  'Максимум одновременно активных задач (status=in_progress). Сумма direct_tasks + project_tasks.';

-- ── Функция: сколько задач у пользователя в работе ────────────────────────
CREATE OR REPLACE FUNCTION get_user_active_wip(p_user_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (
    (SELECT COUNT(*)::INT FROM direct_tasks
       WHERE assignee_id = p_user_id AND status = 'in_progress')
    +
    (SELECT COUNT(*)::INT FROM project_tasks
       WHERE assignee_id = p_user_id AND status = 'in_progress')
  );
$$;

GRANT EXECUTE ON FUNCTION get_user_active_wip(UUID) TO authenticated;

-- ── Функция: лимит сотрудника ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_wip_limit(p_user_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(wip_limit, 5) FROM profiles WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_user_wip_limit(UUID) TO authenticated;
