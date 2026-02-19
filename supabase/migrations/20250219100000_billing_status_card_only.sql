-- card_only: 카드만 등록된 상태(플랜 미선택). 구독은 플랜 선택 후 결제 시 시작.
ALTER TABLE academy_subscriptions
  DROP CONSTRAINT IF EXISTS academy_subscriptions_status_check;

ALTER TABLE academy_subscriptions
  ADD CONSTRAINT academy_subscriptions_status_check
  CHECK (status IN ('card_only', 'trial', 'active', 'past_due', 'canceled', 'expired'));

-- 기존 trial이면서 trial_ends_at 없이 카드만 있던 경우는 card_only로 보지 않고 유지. (선택 사항)
