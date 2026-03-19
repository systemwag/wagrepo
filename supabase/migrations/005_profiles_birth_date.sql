-- ============================================================
-- Migration 005: Add birth_date to profiles
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE;
