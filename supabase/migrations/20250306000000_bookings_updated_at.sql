-- 예약 상태 변경(취소/확정/출석 등) 시각 추적
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN bookings.updated_at IS '예약 상태 등 마지막 수정 시각. 취소 시각 등 조회용';

-- 기존 행에 대해 created_at으로 채우기
UPDATE bookings SET updated_at = COALESCE(created_at::timestamptz, NOW()) WHERE updated_at IS NULL;
