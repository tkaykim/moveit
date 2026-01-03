-- ============================================
-- instructors 테이블에 bio와 specialties 컬럼 추가
-- ============================================
-- 이 파일은 Supabase SQL Editor에서 실행하세요

-- bio 컬럼 추가 (소개)
ALTER TABLE public.instructors 
ADD COLUMN IF NOT EXISTS bio text;

-- specialties 컬럼 추가 (전문 분야)
ALTER TABLE public.instructors 
ADD COLUMN IF NOT EXISTS specialties character varying;

-- 기존 데이터 확인용 (선택사항)
-- SELECT id, name_kr, name_en, bio, specialties FROM public.instructors LIMIT 10;




