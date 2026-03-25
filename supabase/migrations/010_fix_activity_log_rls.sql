-- Migration: 010 — Исправить RLS на activity_log
-- Проблема: WITH CHECK (TRUE) позволяет любому авторизованному пользователю
-- вставлять произвольные записи в лог, включая фейковые.
-- Решение: разрешить INSERT только от своего имени (actor_id = auth.uid())

-- Удаляем старую политику
DROP POLICY IF EXISTS "Система пишет в лог" ON activity_log;

-- Новая политика: можно писать только от своего имени
CREATE POLICY "Пользователь пишет от своего имени" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
