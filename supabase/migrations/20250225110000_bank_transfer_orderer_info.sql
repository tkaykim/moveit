-- 주문자/입금자 정보 및 비회원 주문 지원
ALTER TABLE bank_transfer_orders
  ADD COLUMN IF NOT EXISTS orderer_name TEXT,
  ADD COLUMN IF NOT EXISTS orderer_phone TEXT,
  ADD COLUMN IF NOT EXISTS orderer_email TEXT;

ALTER TABLE bank_transfer_orders
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN bank_transfer_orders.orderer_name IS '주문자명(입금자명). 로그인 시 프로필/입금자명, 비회원 시 입력값';
COMMENT ON COLUMN bank_transfer_orders.orderer_phone IS '주문자 연락처';
COMMENT ON COLUMN bank_transfer_orders.orderer_email IS '주문자 이메일';
