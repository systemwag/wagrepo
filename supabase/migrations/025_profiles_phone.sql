-- ============================================================
-- Migration 025: add phone column to profiles
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN profiles.phone IS
  'Контактный телефон в международном формате (+7XXXXXXXXXX). Используется для отображения; не для аутентификации.';
