-- ============================================================
-- Migration 003: Stage Documents & Director Review Status
-- ============================================================

-- Статус проверки директором
CREATE TYPE review_status AS ENUM ('pending_review', 'approved', 'revision_needed');

-- Добавить поля проверки в project_stages
ALTER TABLE project_stages
  ADD COLUMN IF NOT EXISTS review_status  review_status,
  ADD COLUMN IF NOT EXISTS reviewed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ;

-- Привязать документы к этапу
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES project_stages(id) ON DELETE CASCADE;

-- ============================================================
-- Supabase Storage bucket: project-files
-- Создать вручную в Dashboard → Storage → New bucket → "project-files"
-- Public: OFF (используем signed URLs)
-- Allowed MIME types: application/pdf, image/jpeg, image/jpg, image/png
-- ============================================================
