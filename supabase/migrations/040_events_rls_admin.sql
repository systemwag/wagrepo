-- ============================================================
-- Migration 040: RLS на events — переписать через has_director_access()
-- ============================================================
-- Миграция 009 завела events с политиками, требующими роль строго 'director'.
-- Миграция 028 переписала большинство таблиц на has_director_access()
-- (которая включает admin), но events не были обновлены.
--
-- Теперь admin может создавать, редактировать и удалять события — это нужно
-- для админ-панели /dashboard/admin/events.
-- Идемпотентна.
-- ============================================================

DROP POLICY IF EXISTS "events_insert" ON events;
CREATE POLICY "events_insert" ON events
  FOR INSERT TO authenticated
  WITH CHECK (has_director_access());

DROP POLICY IF EXISTS "events_update" ON events;
CREATE POLICY "events_update" ON events
  FOR UPDATE TO authenticated
  USING (has_director_access());

DROP POLICY IF EXISTS "events_delete" ON events;
CREATE POLICY "events_delete" ON events
  FOR DELETE TO authenticated
  USING (has_director_access());

DROP POLICY IF EXISTS "ep_insert" ON event_participants;
CREATE POLICY "ep_insert" ON event_participants
  FOR INSERT TO authenticated
  WITH CHECK (has_director_access());

DROP POLICY IF EXISTS "ep_delete" ON event_participants;
CREATE POLICY "ep_delete" ON event_participants
  FOR DELETE TO authenticated
  USING (has_director_access());
