-- ============================================================
-- Migration 051: опросы команде
-- ============================================================
-- Любой сотрудник создаёт опрос (вопрос + варианты или текст), адресует
-- всем или конкретным людям, задаёт дедлайн. Адресаты отвечают один раз,
-- автор видит распределение ответов. Не анонимно.
--
-- Архитектура:
--   polls            — сам вопрос + конфиг (тип, варианты, аудитория, дедлайн)
--   poll_targets     — junction для адресной аудитории
--   poll_responses   — ответы (один на пользователя)
--
-- RLS-хелперы SECURITY DEFINER рвут потенциальную взаимную зависимость
-- polls ↔ poll_targets (см. memory: project_rls_recursion_helpers).
-- ============================================================

-- ── ENUM-типы ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poll_type') THEN
    CREATE TYPE poll_type AS ENUM ('single_choice', 'multiple_choice', 'text');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poll_audience') THEN
    CREATE TYPE poll_audience AS ENUM ('all', 'specific');
  END IF;
END $$;


-- ── polls ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ,                                  -- NULL = активен
  question    TEXT NOT NULL,
  type        poll_type NOT NULL,
  -- Для choice-типов: [{"id":"a","label":"Да"}, …]; для text — NULL.
  options     JSONB,
  audience    poll_audience NOT NULL,
  deadline    TIMESTAMPTZ NOT NULL,

  -- Структурные ограничения по типу:
  CONSTRAINT polls_options_match_type CHECK (
    (type = 'text'   AND options IS NULL)
    OR (type IN ('single_choice','multiple_choice') AND jsonb_typeof(options) = 'array' AND jsonb_array_length(options) >= 2)
  )
);

CREATE INDEX IF NOT EXISTS idx_polls_created_by ON polls(created_by);
CREATE INDEX IF NOT EXISTS idx_polls_deadline   ON polls(deadline);
CREATE INDEX IF NOT EXISTS idx_polls_closed_at  ON polls(closed_at) WHERE closed_at IS NULL;


-- ── poll_targets (для audience='specific') ─────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_targets (
  poll_id  UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_targets_user ON poll_targets(user_id);


-- ── poll_responses ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_responses (
  poll_id              UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submitted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  text_answer          TEXT,
  -- Массив id выбранных вариантов: ["a","c"]. Для single_choice — один элемент.
  selected_option_ids  JSONB,
  PRIMARY KEY (poll_id, user_id),

  -- Ровно одна из колонок ответа заполнена:
  CONSTRAINT poll_responses_one_answer CHECK (
    (text_answer IS NOT NULL AND selected_option_ids IS NULL)
    OR
    (text_answer IS NULL AND selected_option_ids IS NOT NULL
      AND jsonb_typeof(selected_option_ids) = 'array'
      AND jsonb_array_length(selected_option_ids) >= 1)
  )
);

CREATE INDEX IF NOT EXISTS idx_poll_responses_user ON poll_responses(user_id);


-- ── SECURITY DEFINER хелперы для RLS ───────────────────────────────────────

CREATE OR REPLACE FUNCTION is_poll_creator(p_poll_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM polls WHERE id = p_poll_id AND created_by = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION is_poll_creator(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION can_see_poll(p_poll_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM polls
     WHERE id = p_poll_id
       AND (
         created_by = auth.uid()
         OR audience = 'all'
         OR EXISTS (SELECT 1 FROM poll_targets pt WHERE pt.poll_id = p_poll_id AND pt.user_id = auth.uid())
       )
  )
$$;
GRANT EXECUTE ON FUNCTION can_see_poll(UUID) TO authenticated;


-- ── RLS: polls ─────────────────────────────────────────────────────────────

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY polls_select ON polls
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR audience = 'all'
    OR EXISTS (SELECT 1 FROM poll_targets pt WHERE pt.poll_id = polls.id AND pt.user_id = auth.uid())
  );

CREATE POLICY polls_insert ON polls
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY polls_update ON polls
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY polls_delete ON polls
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());


-- ── RLS: poll_targets ──────────────────────────────────────────────────────

ALTER TABLE poll_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY poll_targets_select ON poll_targets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_poll_creator(poll_id));

CREATE POLICY poll_targets_insert ON poll_targets
  FOR INSERT TO authenticated
  WITH CHECK (is_poll_creator(poll_id));

CREATE POLICY poll_targets_delete ON poll_targets
  FOR DELETE TO authenticated
  USING (is_poll_creator(poll_id));


-- ── RLS: poll_responses ────────────────────────────────────────────────────

ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY poll_responses_select ON poll_responses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_poll_creator(poll_id));

CREATE POLICY poll_responses_insert ON poll_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND can_see_poll(poll_id)
    AND EXISTS (
      SELECT 1 FROM polls
       WHERE id = poll_id
         AND closed_at IS NULL
         AND deadline > NOW()
    )
  );

-- UPDATE/DELETE на poll_responses не разрешён никому — ответ финален.


-- ── Уведомления (notification_type += 'poll') ──────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'poll'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'poll';
  END IF;
END $$;


-- ── Триггер: уведомить адресатов о новом опросе ────────────────────────────
-- Для audience='all' рассылаем всем профилям (кроме автора).
-- Для audience='specific' уведомления вешаем на INSERT в poll_targets.

CREATE OR REPLACE FUNCTION trigger_notify_poll_all()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.audience = 'all' THEN
    INSERT INTO notifications (user_id, title, message, type, linked_id)
    SELECT
      p.id,
      'Новый опрос',
      'Вам предложено ответить: «' || NEW.question || '»',
      'poll',
      NEW.id
    FROM profiles p
    WHERE p.id <> NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_poll_all ON polls;
CREATE TRIGGER notify_poll_all
  AFTER INSERT ON polls
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_poll_all();


CREATE OR REPLACE FUNCTION trigger_notify_poll_target()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question TEXT;
  v_creator  UUID;
BEGIN
  SELECT question, created_by INTO v_question, v_creator
    FROM polls WHERE id = NEW.poll_id;

  -- Не уведомлять автора, если он зачем-то добавил сам себя.
  IF NEW.user_id IS DISTINCT FROM v_creator THEN
    INSERT INTO notifications (user_id, title, message, type, linked_id)
    VALUES (
      NEW.user_id,
      'Новый опрос',
      'Вам предложено ответить: «' || v_question || '»',
      'poll',
      NEW.poll_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_poll_target ON poll_targets;
CREATE TRIGGER notify_poll_target
  AFTER INSERT ON poll_targets
  FOR EACH ROW EXECUTE FUNCTION trigger_notify_poll_target();


-- ── Realtime ───────────────────────────────────────────────────────────────
-- Авторы хотят видеть ответы по мере поступления.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'poll_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE poll_responses;
  END IF;
END $$;
