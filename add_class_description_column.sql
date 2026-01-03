-- ============================================
-- classes 테이블에 description 컬럼 추가
-- ============================================
-- 이 파일은 Supabase SQL Editor에서 실행하세요

-- description 컬럼 추가 (클래스 설명, NULL 허용)
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS description text NULL;

-- 기존 데이터 확인용 (선택사항)
-- SELECT id, title, description FROM public.classes LIMIT 10;

