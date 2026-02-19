-- ================================================================
-- MOVEIT 빌링 시스템 마이그레이션
-- 학원 관리자가 플랫폼 사용료를 결제하는 구독 시스템
-- ================================================================

-- 1. 빌링 플랜 정의 (SUPER_ADMIN이 관리)
CREATE TABLE IF NOT EXISTS billing_plans (
  id                      VARCHAR(20) PRIMARY KEY,           -- 'starter', 'growth', 'pro'
  display_name            VARCHAR(100) NOT NULL,              -- '스타터', '그로스', '프로'
  description             TEXT,
  monthly_price           INTEGER NOT NULL,                   -- 월간 결제 금액 (원)
  annual_price_per_month  INTEGER NOT NULL,                   -- 연간 결제 시 월 환산 금액 (원)
  max_students            INTEGER,                            -- 최대 수강생 수 (NULL = 무제한)
  features                JSONB NOT NULL DEFAULT '[]'::JSONB, -- 포함된 기능 키 목록
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 학원 구독 정보
CREATE TABLE IF NOT EXISTS academy_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id            UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  plan_id               VARCHAR(20) NOT NULL REFERENCES billing_plans(id),
  billing_cycle         VARCHAR(10) NOT NULL DEFAULT 'monthly'
                          CHECK (billing_cycle IN ('monthly', 'annual')),
  status                VARCHAR(20) NOT NULL DEFAULT 'trial'
                          CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'expired')),

  -- 체험 기간
  trial_ends_at         TIMESTAMPTZ,

  -- 현재 결제 구간
  current_period_start  DATE,
  current_period_end    DATE,

  -- 토스페이먼츠 자동결제 정보
  toss_customer_key     VARCHAR(255) UNIQUE,  -- 학원별 고유 고객 키
  toss_billing_key      VARCHAR(255),          -- 자동결제용 빌링 키

  -- 등록된 카드 정보 (마스킹)
  card_company          VARCHAR(50),
  card_number_masked    VARCHAR(20),           -- 예: "****1234"

  -- 구독 취소
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE, -- 기간 말 취소 예약
  canceled_at           TIMESTAMPTZ,
  cancellation_reason   TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 결제 이력
CREATE TABLE IF NOT EXISTS subscription_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES academy_subscriptions(id) ON DELETE CASCADE,
  academy_id       UUID NOT NULL REFERENCES academies(id),

  -- 결제 정보
  amount           INTEGER NOT NULL,        -- 결제 금액 (원)
  billing_cycle    VARCHAR(10) NOT NULL
                     CHECK (billing_cycle IN ('monthly', 'annual')),
  period_start     DATE,
  period_end       DATE,

  -- 토스페이먼츠 결제 정보
  toss_payment_key VARCHAR(255),
  toss_order_id    VARCHAR(255) UNIQUE,     -- 결제 주문 ID (중복 방지)

  -- 결제 상태
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  -- 실패 처리
  failure_code     VARCHAR(50),
  failure_message  TEXT,
  retry_count      INTEGER NOT NULL DEFAULT 0,
  next_retry_at    TIMESTAMPTZ,

  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 인덱스
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_academy_subscriptions_academy_id
  ON academy_subscriptions(academy_id);

CREATE INDEX IF NOT EXISTS idx_academy_subscriptions_status
  ON academy_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_academy_subscriptions_period_end
  ON academy_subscriptions(current_period_end);

CREATE INDEX IF NOT EXISTS idx_academy_subscriptions_trial_ends
  ON academy_subscriptions(trial_ends_at);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id
  ON subscription_payments(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_academy_id
  ON subscription_payments(academy_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_status
  ON subscription_payments(status);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_created_at
  ON subscription_payments(created_at DESC);

-- ================================================================
-- updated_at 자동 갱신 트리거
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_plans_updated_at
  BEFORE UPDATE ON billing_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER academy_subscriptions_updated_at
  BEFORE UPDATE ON academy_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- RLS (Row Level Security) 정책
-- ================================================================
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- billing_plans: 모든 인증 사용자 읽기 가능, SUPER_ADMIN만 수정
CREATE POLICY "billing_plans_read" ON billing_plans
  FOR SELECT USING (TRUE);

CREATE POLICY "billing_plans_admin_write" ON billing_plans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- academy_subscriptions: SUPER_ADMIN 전체 접근, 학원 관리자는 자기 학원만
CREATE POLICY "academy_subscriptions_super_admin" ON academy_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "academy_subscriptions_academy_read" ON academy_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM academy_user_roles
      WHERE user_id = auth.uid()
        AND academy_id = academy_subscriptions.academy_id
        AND role IN ('ACADEMY_OWNER', 'ACADEMY_MANAGER')
    )
  );

CREATE POLICY "academy_subscriptions_academy_update" ON academy_subscriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM academy_user_roles
      WHERE user_id = auth.uid()
        AND academy_id = academy_subscriptions.academy_id
        AND role = 'ACADEMY_OWNER'
    )
  );

-- subscription_payments: SUPER_ADMIN 전체, 학원 관리자는 자기 학원만
CREATE POLICY "subscription_payments_super_admin" ON subscription_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "subscription_payments_academy_read" ON subscription_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM academy_user_roles
      WHERE user_id = auth.uid()
        AND academy_id = subscription_payments.academy_id
        AND role IN ('ACADEMY_OWNER', 'ACADEMY_MANAGER')
    )
  );

-- ================================================================
-- 초기 플랜 데이터 시드
-- ================================================================
INSERT INTO billing_plans (id, display_name, description, monthly_price, annual_price_per_month, max_students, features, sort_order)
VALUES
  (
    'starter',
    '스타터',
    '소규모 스튜디오를 위한 핵심 운영 기능',
    49000,
    39200,
    100,
    '["basic_schedule","tickets","qr_attendance","basic_stats"]'::JSONB,
    1
  ),
  (
    'growth',
    '그로스',
    '재수강율을 높이고 운영을 자동화하고 싶은 학원',
    99000,
    79200,
    NULL,
    '["basic_schedule","tickets","qr_attendance","push_notifications","ticket_expiry_alert","absence_care_alert","salary_settlement","advanced_stats"]'::JSONB,
    2
  ),
  (
    'pro',
    '프로',
    '다중 지점 관리와 고급 기능이 필요한 프랜차이즈',
    199000,
    159200,
    NULL,
    '["basic_schedule","tickets","qr_attendance","push_notifications","ticket_expiry_alert","absence_care_alert","salary_settlement","advanced_stats","multi_location","custom_api","dedicated_manager"]'::JSONB,
    3
  )
ON CONFLICT (id) DO UPDATE SET
  display_name           = EXCLUDED.display_name,
  description            = EXCLUDED.description,
  monthly_price          = EXCLUDED.monthly_price,
  annual_price_per_month = EXCLUDED.annual_price_per_month,
  max_students           = EXCLUDED.max_students,
  features               = EXCLUDED.features,
  sort_order             = EXCLUDED.sort_order,
  updated_at             = NOW();
