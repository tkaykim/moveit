-- billing_scenario.md 4.1~4.5 구현 계획: 스키마 확장
-- 기존 테이블명·컬럼 유지, 최소 추가만 수행

-- 4.1 Dunning: 유예 기간
ALTER TABLE academy_subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_end DATE NULL;

-- 4.3 쿠폰/프로모션 (최소)
ALTER TABLE academy_subscriptions ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50) NULL;
ALTER TABLE academy_subscriptions ADD COLUMN IF NOT EXISTS discount_percent INTEGER NULL;
ALTER TABLE academy_subscriptions ADD COLUMN IF NOT EXISTS first_month_free BOOLEAN NOT NULL DEFAULT FALSE;

-- 4.2 웹훅 멱등: 이벤트 저장 테이블
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_snapshot JSONB NULL
);

-- 4.5 세션 제한 (플랜별): null = 무제한
ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS max_sessions INTEGER NULL;
