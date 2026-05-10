-- Migration: p1_revenue_actor_user_id (2026-05-10)
-- Purpose: revenue_transactions 행을 누가(본인 vs 관리자 대행) 발생시켰는지 구분하기 위해
--          actor_user_id 컬럼을 추가한다. 기존 행은 NULL 로 남겨 "본인 결제(레거시)" 의 의미로
--          취급하고, 신규 코드는 반드시 채워서 INSERT 한다.

ALTER TABLE revenue_transactions
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES users(id);

COMMENT ON COLUMN revenue_transactions.actor_user_id IS
  '결제를 실제로 트리거한 사용자(본인 결제면 user_id 와 동일, 관리자 대행이면 admin id). 2026-05 이전 데이터는 NULL.';

CREATE INDEX IF NOT EXISTS idx_revenue_transactions_actor_user_id
  ON revenue_transactions(actor_user_id);
