-- bookings 테이블에 guest_email 컬럼 추가 (비회원 예약 시 이메일 저장용)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_email TEXT DEFAULT NULL;
