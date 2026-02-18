-- 강사 프로필과 로그인 유저 연결용 user_id 컬럼 추가
-- 실행: Supabase SQL Editor 또는 psql에서 public 스키마에 적용

ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 한 유저가 한 강사 프로필만 가지도록 (nullable이므로 partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_user_id
  ON public.instructors(user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.instructors.user_id IS '로그인 유저와 1:1 연결. 있으면 해당 유저가 강사 대시보드 접근 가능.';
