-- ============================================================
-- Migration 053: директор и админ могут редактировать/удалять любые опросы
-- ============================================================
-- Зачем: чтобы не засорять БД, директор должен иметь возможность вычистить
-- устаревшие/ошибочные опросы коллег. Изначально (051) UPDATE/DELETE на polls
-- мог делать только автор.
--
-- Используем существующий хелпер has_director_access() из миграции 028
-- (он покрывает и director, и admin).
-- ============================================================

-- ── polls ──────────────────────────────────────────────────────────────────

-- Расширяем SELECT: директор/админ видит ВСЕ опросы, чтобы иметь возможность
-- их чистить и просматривать результаты, даже если он не автор и не в аудитории.
DROP POLICY IF EXISTS polls_select ON polls;
CREATE POLICY polls_select ON polls
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR audience = 'all'
    OR EXISTS (SELECT 1 FROM poll_targets pt WHERE pt.poll_id = polls.id AND pt.user_id = auth.uid())
    OR has_director_access()
  );

-- Аналогично для poll_targets — директор видит, кто адресат.
DROP POLICY IF EXISTS poll_targets_select ON poll_targets;
CREATE POLICY poll_targets_select ON poll_targets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_poll_creator(poll_id) OR has_director_access());

-- И для poll_responses — директор видит все ответы для аналитики/чистки.
DROP POLICY IF EXISTS poll_responses_select ON poll_responses;
CREATE POLICY poll_responses_select ON poll_responses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_poll_creator(poll_id) OR has_director_access());

DROP POLICY IF EXISTS polls_update ON polls;
CREATE POLICY polls_update ON polls
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_director_access())
  WITH CHECK (created_by = auth.uid() OR has_director_access());

DROP POLICY IF EXISTS polls_delete ON polls;
CREATE POLICY polls_delete ON polls
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_director_access());


-- ── poll_targets ───────────────────────────────────────────────────────────
-- Чтобы редактирование аудитории через UI работало для админа/директора,
-- они должны добавлять и удалять адресатов в чужих опросах.

DROP POLICY IF EXISTS poll_targets_insert ON poll_targets;
CREATE POLICY poll_targets_insert ON poll_targets
  FOR INSERT TO authenticated
  WITH CHECK (is_poll_creator(poll_id) OR has_director_access());

DROP POLICY IF EXISTS poll_targets_delete ON poll_targets;
CREATE POLICY poll_targets_delete ON poll_targets
  FOR DELETE TO authenticated
  USING (is_poll_creator(poll_id) OR has_director_access());
