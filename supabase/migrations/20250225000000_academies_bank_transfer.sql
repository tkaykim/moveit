-- 학원 입금 계좌 정보 (계좌이체 결제용)
ALTER TABLE academies
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_depositor_name TEXT;

COMMENT ON COLUMN academies.bank_name IS '입금 받을 은행명';
COMMENT ON COLUMN academies.bank_account_number IS '입금 받을 계좌번호';
COMMENT ON COLUMN academies.bank_depositor_name IS '입금자명(예금주)';
