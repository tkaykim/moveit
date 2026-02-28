-- 입금 시 사용할 이름(입금자명) — 주문자명과 다를 수 있음. 관리자 검색/표시용
ALTER TABLE bank_transfer_orders
  ADD COLUMN IF NOT EXISTS depositor_name TEXT;

COMMENT ON COLUMN bank_transfer_orders.depositor_name IS '입금 시 계좌에 표시할 이름(입금자명). orderer_name과 다를 수 있음';
