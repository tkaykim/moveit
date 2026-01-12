-- 클래스(반) 활성화 여부 필드 추가 마이그레이션
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요.

-- 1. classes 테이블에 is_active 컬럼 추가
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. 기존 데이터에 대해 is_active를 true로 설정 (is_canceled가 false인 경우)
UPDATE public.classes
SET is_active = true
WHERE is_active IS NULL AND (is_canceled IS NULL OR is_canceled = false);

-- 3. 삭제된 클래스는 비활성화 상태로 설정
UPDATE public.classes
SET is_active = false
WHERE is_canceled = true;

-- 4. 인덱스 추가 (활성화 상태로 필터링할 때 성능 향상)
CREATE INDEX IF NOT EXISTS idx_classes_is_active ON public.classes(is_active);

-- 5. 복합 인덱스 추가 (academy_id와 is_active로 함께 조회할 때)
CREATE INDEX IF NOT EXISTS idx_classes_academy_active ON public.classes(academy_id, is_active);

COMMENT ON COLUMN public.classes.is_active IS '클래스 활성화 여부. true: 활성화(스케줄 생성 가능), false: 비활성화(스케줄 생성 목록에서 숨김)';
