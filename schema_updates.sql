-- ============================================
-- Schema Updates for Drag & Drop and Recurring Todos
-- ============================================

-- 1. Repeat Type Enum 생성
DO $$ BEGIN
  CREATE TYPE repeat_type AS ENUM ('none', 'hourly', 'daily', 'weekly', 'monthly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. todos 테이블에 순서 및 반복 필드 추가
ALTER TABLE public.todos 
  ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_type repeat_type DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS repeat_interval INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS repeat_days_of_week INTEGER[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_todo_id UUID REFERENCES public.todos(id) ON DELETE CASCADE DEFAULT NULL;

-- 3. position 인덱스 추가 (정렬 성능 향상)
CREATE INDEX IF NOT EXISTS idx_todos_position ON public.todos(user_id, priority, position);

-- 4. 반복 할 일 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_todos_repeat ON public.todos(user_id, repeat_type) WHERE repeat_type != 'none';

-- 5. parent_todo_id 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_todos_parent ON public.todos(parent_todo_id) WHERE parent_todo_id IS NOT NULL;

