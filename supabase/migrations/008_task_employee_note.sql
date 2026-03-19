-- Add employee feedback field to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS employee_note TEXT;
