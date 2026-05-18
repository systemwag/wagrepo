-- ============================================================
-- Migration 049: тип уведомления `direct_task_feedback`
-- ============================================================
-- Зачем: сейчас при ответе сотрудника по поручению автору (директору/
-- менеджеру) уходит уведомление с type='direct_task'. Клик ведёт на
-- /dashboard/assignments — но автор там ничего не увидит, он не исполнитель.
-- Новый тип отличает «ответ автору» от «новое поручение исполнителю»
-- и позволяет роутить такие уведомления на /dashboard/assign.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'direct_task_feedback'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'direct_task_feedback';
  END IF;
END $$;
