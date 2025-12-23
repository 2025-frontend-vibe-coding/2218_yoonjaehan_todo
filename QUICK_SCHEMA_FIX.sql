-- ============================================
-- 빠른 스키마 수정: position 필드만 추가
-- ============================================
-- 이 파일을 Supabase SQL Editor에서 실행하세요

-- position 필드 추가 (이미 있으면 무시)
ALTER TABLE public.todos 
  ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- position 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_todos_position ON public.todos(user_id, priority, position);

-- 완료! 이제 드래그 앤 드롭이 작동합니다.

