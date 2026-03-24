-- =====================================================
-- 009_events.sql — Модуль мероприятий
-- =====================================================

CREATE TYPE event_importance AS ENUM ('low', 'medium', 'high', 'critical');

-- Мероприятия
CREATE TABLE events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  date          DATE NOT NULL,
  start_time    TIME,
  end_time      TIME,
  location      TEXT,
  importance    event_importance NOT NULL DEFAULT 'medium',
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Участники мероприятия
CREATE TABLE event_participants (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(event_id, user_id)
);

-- Индексы
CREATE INDEX idx_events_date        ON events(date);
CREATE INDEX idx_events_created_by  ON events(created_by);
CREATE INDEX idx_ep_event_id        ON event_participants(event_id);
CREATE INDEX idx_ep_user_id         ON event_participants(user_id);

-- Автообновление updated_at
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_events_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- Все авторизованные видят мероприятия
CREATE POLICY "events_select" ON events
  FOR SELECT TO authenticated USING (true);

-- Создавать могут только директора
CREATE POLICY "events_insert" ON events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'director');

-- Редактировать — только директора
CREATE POLICY "events_update" ON events
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'director');

-- Удалять — только директора
CREATE POLICY "events_delete" ON events
  FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'director');

-- Участники: все видят
CREATE POLICY "ep_select" ON event_participants
  FOR SELECT TO authenticated USING (true);

-- Управление участниками — только директора
CREATE POLICY "ep_insert" ON event_participants
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'director');

CREATE POLICY "ep_delete" ON event_participants
  FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'director');
