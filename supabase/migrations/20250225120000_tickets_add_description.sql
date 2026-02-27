-- 수강권 상품 설명 (선택). 사용자 수강권 목록에서 표시.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN tickets.description IS '수강권 상품 설명. 사용자 수강권 목록에서 표시.';
