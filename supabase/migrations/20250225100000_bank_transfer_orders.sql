-- 계좌이체 신청 주문 (입금 대기 → 관리자 입금확인 시 수강권 발급·예약 완료)
CREATE TABLE IF NOT EXISTS bank_transfer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  count_option_index INTEGER,
  discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL,
  order_name TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
  user_ticket_id UUID REFERENCES user_tickets(id) ON DELETE SET NULL,
  revenue_transaction_id UUID REFERENCES revenue_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_orders_academy_status
  ON bank_transfer_orders(academy_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_orders_user_id
  ON bank_transfer_orders(user_id);

COMMENT ON TABLE bank_transfer_orders IS '계좌이체 신청 주문. PENDING=입금대기, CONFIRMED=입금확인완료';
