-- 태그 스키마 추가 SQL
-- academies 테이블에 tags 컬럼 추가 (여러 개의 태그를 comma-separated string으로 저장)

-- academies 테이블에 tags 컬럼 추가
ALTER TABLE public.academies 
ADD COLUMN IF NOT EXISTS tags text;

-- 주석 추가
COMMENT ON COLUMN public.academies.tags IS '학원 태그 (쉼표로 구분된 여러 태그 저장, 예: "Hip-hop, Choreography, K-POP")';

