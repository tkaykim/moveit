-- ============================================
-- classes 테이블의 class_type 체크 제약 조건 업데이트
-- ============================================
-- 이 파일은 Supabase SQL Editor에서 실행하세요

-- 기존 체크 제약 조건 삭제
ALTER TABLE public.classes 
DROP CONSTRAINT IF EXISTS classes_class_type_check;

-- 새로운 체크 제약 조건 추가 (코드에서 사용하는 값들 포함)
ALTER TABLE public.classes 
ADD CONSTRAINT classes_class_type_check 
CHECK (class_type::text = ANY (ARRAY[
  'regular'::character varying,
  'popup'::character varying,
  'workshop'::character varying,
  'REGULAR'::character varying,
  'ONE_DAY'::character varying,
  'PRIVATE'::character varying,
  'RENTAL'::character varying
]::text[]));

-- 기존 데이터 확인용 (선택사항)
-- SELECT id, title, class_type FROM public.classes LIMIT 10;



