-- ============================================================
-- Migration 054: добавить INSERT-политику для notifications
-- ============================================================
-- Симптом (обнаружен 2026-05-18): уведомления, отправляемые из Server
-- Actions (submitDirectTaskFeedback, rejectHandover, deleteEvent,
-- updateEvent), не доходили до получателей.
--
-- Причина: миграция 011 определила политики SELECT/UPDATE/DELETE для
-- notifications, но не INSERT. RLS включён → INSERT по умолчанию deny.
-- Триггеры БД работали (SECURITY DEFINER обходит RLS), а INSERT из кода
-- молча возвращал permission_denied, ошибка не проверялась в Server Action.
--
-- Решение: разрешить INSERT любому авторизованному пользователю.
-- Notifications — не sensitive data, это event-сообщения; security
-- boundary на уровне получателя (notifications_select user_id=auth.uid()),
-- а не отправителя.
-- ============================================================

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
