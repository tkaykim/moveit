-- 비회원 예약 시 이메일 저장 — 연동(link-guest-bookings)에서 이메일 기준 매칭용
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

COMMENT ON COLUMN bookings.guest_email IS '비회원 예약 시 입력한 이메일. 연동 시 user.email과 매칭에 사용';
