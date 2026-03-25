-- ============================================================
-- WAG System — Database Schema
-- ============================================================

-- Роли пользователей
CREATE TYPE user_role AS ENUM ('director', 'manager', 'employee');

-- Статусы проекта
CREATE TYPE project_status AS ENUM ('active', 'on_hold', 'completed', 'cancelled');

-- Статусы задачи
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');

-- Приоритет задачи
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- ============================================================
-- PROFILES — профили пользователей (расширение auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  position TEXT,
  department TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECTS — проекты
-- ============================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'active',
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  client_name TEXT,
  contract_number TEXT,
  budget NUMERIC(15, 2),
  start_date DATE,
  deadline DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECT_STAGES — этапы проекта (колонки Kanban)
-- ============================================================
CREATE TABLE project_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS — задачи
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES project_stages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deadline DATE,
  estimated_hours NUMERIC(6, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASK_REPORTS — отчёты по задачам
-- ============================================================
CREATE TABLE task_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  hours_spent NUMERIC(6, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS — файлы и документы
-- ============================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACTIVITY_LOG — лог всех действий
-- ============================================================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- 'project' | 'task' | 'report'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,      -- 'created' | 'updated' | 'deleted' | 'status_changed'
  meta JSONB,                -- доп. данные об изменении
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ФУНКЦИЯ: автообновление updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ФУНКЦИЯ: автосоздание профиля при регистрации
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee'::user_role)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Вспомогательная функция: получить роль текущего пользователя
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "Все видят профили" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "Только свой профиль можно редактировать" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Директор управляет профилями" ON profiles FOR ALL USING (get_my_role() = 'director');

-- PROJECTS
CREATE POLICY "Все видят проекты" ON projects FOR SELECT USING (TRUE);
CREATE POLICY "Директор и менеджер создают проекты" ON projects FOR INSERT WITH CHECK (get_my_role() IN ('director', 'manager'));
CREATE POLICY "Директор и менеджер редактируют проекты" ON projects FOR UPDATE USING (get_my_role() IN ('director', 'manager'));
CREATE POLICY "Только директор удаляет проекты" ON projects FOR DELETE USING (get_my_role() = 'director');

-- PROJECT_STAGES
CREATE POLICY "Все видят этапы" ON project_stages FOR SELECT USING (TRUE);
CREATE POLICY "Менеджер и директор управляют этапами" ON project_stages FOR ALL USING (get_my_role() IN ('director', 'manager'));

-- TASKS
CREATE POLICY "Все видят задачи" ON tasks FOR SELECT USING (TRUE);
CREATE POLICY "Менеджер и директор создают задачи" ON tasks FOR INSERT WITH CHECK (get_my_role() IN ('director', 'manager'));
CREATE POLICY "Исполнитель и менеджер редактируют задачи" ON tasks FOR UPDATE USING (
  get_my_role() IN ('director', 'manager') OR assignee_id = auth.uid()
);
CREATE POLICY "Только директор и менеджер удаляют задачи" ON tasks FOR DELETE USING (get_my_role() IN ('director', 'manager'));

-- TASK_REPORTS
CREATE POLICY "Все видят отчёты" ON task_reports FOR SELECT USING (TRUE);
CREATE POLICY "Каждый пишет свой отчёт" ON task_reports FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Только автор редактирует отчёт" ON task_reports FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Директор удаляет отчёты" ON task_reports FOR DELETE USING (get_my_role() = 'director');

-- DOCUMENTS
CREATE POLICY "Все видят документы" ON documents FOR SELECT USING (TRUE);
CREATE POLICY "Загружать могут все" ON documents FOR INSERT WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Директор удаляет документы" ON documents FOR DELETE USING (get_my_role() = 'director');

-- ACTIVITY_LOG
CREATE POLICY "Все видят лог" ON activity_log FOR SELECT USING (TRUE);
CREATE POLICY "Пользователь пишет от своего имени" ON activity_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
