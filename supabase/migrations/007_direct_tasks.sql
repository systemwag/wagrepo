-- Allow tasks to exist without a project (direct assignments)
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;
