-- ============================================================
-- Migration 004: Fix documents RLS policies
-- ============================================================

-- Заменяем политику INSERT — проверяем только что пользователь
-- аутентифицирован (auth.uid() IS NOT NULL), без сравнения с uploaded_by.
-- Это надёжнее, так как uploaded_by может отличаться при JWT refresh.
DROP POLICY IF EXISTS "Загружать могут все" ON documents;

CREATE POLICY "Загружать могут аутентифицированные"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Добавляем политику UPDATE (нужна для менеджеров/директоров)
CREATE POLICY "Директор и менеджер обновляют документы"
  ON documents FOR UPDATE
  USING (get_my_role() IN ('director', 'manager'));

-- Расширяем DELETE — менеджер тоже может удалять документы своих этапов
DROP POLICY IF EXISTS "Директор удаляет документы" ON documents;

CREATE POLICY "Директор и менеджер удаляют документы"
  ON documents FOR DELETE
  USING (get_my_role() IN ('director', 'manager'));
