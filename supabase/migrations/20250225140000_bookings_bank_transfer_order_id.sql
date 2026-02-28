-- 입금 대기 시 출석/신청 관리 명단 반영: booking과 bank_transfer_order 연결
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS bank_transfer_order_id UUID REFERENCES bank_transfer_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_bank_transfer_order_id ON bookings(bank_transfer_order_id);
COMMENT ON COLUMN bookings.bank_transfer_order_id IS '계좌이체 주문 연결. 입금 확인 시 해당 booking을 CONFIRMED로 업데이트';
