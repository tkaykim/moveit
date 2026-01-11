-- academy_images 테이블 삭제 스크립트
-- academies.images JSONB 컬럼으로 대체되었으므로 더 이상 필요하지 않음

-- 외래키 제약조건 먼저 삭제
ALTER TABLE IF EXISTS public.academy_images 
DROP CONSTRAINT IF EXISTS academy_images_academy_id_fkey;

-- 테이블 삭제
DROP TABLE IF EXISTS public.academy_images;


