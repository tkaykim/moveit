// ================================================================
// MOVEIT 빌링 시스템 타입 정의
// 학원 관리자가 플랫폼 사용료를 결제하는 구독 시스템
// ================================================================

export type BillingPlanId = 'starter' | 'growth' | 'pro';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'card_only' | 'trial' | 'active' | 'past_due' | 'canceled' | 'expired';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// 각 플랜에 포함된 기능 키
export type BillingFeatureKey =
  | 'basic_schedule'         // 기본 스케줄 & 예약
  | 'tickets'                // 수강권 & 상품 관리
  | 'qr_attendance'          // QR 출석 체크
  | 'basic_stats'            // 기본 매출 통계
  | 'push_notifications'     // 푸시 알림 발송
  | 'ticket_expiry_alert'    // 수강권 만기 자동 D-Day 알림
  | 'absence_care_alert'     // 미출석/장기결석 케어 알림
  | 'salary_settlement'      // 강사 급여 정산
  | 'advanced_stats'         // 고급 매출 통계 & 리포트
  | 'multi_location'         // 다중 지점 통합 관리
  | 'custom_api'             // 커스텀 API 연동
  | 'dedicated_manager';     // 전담 매니저 배정

export const BILLING_FEATURE_LABELS: Record<BillingFeatureKey, string> = {
  basic_schedule: '기본 스케줄 & 예약 시스템',
  tickets: '수강권 & 상품 관리',
  qr_attendance: 'QR 코드 출석 체크',
  basic_stats: '기본 매출 통계',
  push_notifications: '푸시 알림 발송',
  ticket_expiry_alert: '수강권 만기 자동 D-Day 알림',
  absence_care_alert: '미출석/장기결석 케어 알림',
  salary_settlement: '강사 급여 정산',
  advanced_stats: '고급 매출 통계 & 리포트',
  multi_location: '다중 지점 통합 관리',
  custom_api: '커스텀 API 연동',
  dedicated_manager: '전담 매니저 배정',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  card_only: '플랜 미선택',
  trial: '체험 중',
  active: '활성',
  past_due: '미납',
  canceled: '취소됨',
  expired: '만료됨',
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: '월간',
  annual: '연간',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: '처리 중',
  completed: '결제 완료',
  failed: '결제 실패',
  refunded: '환불됨',
};

// ----------------------------------------------------------------
// DB 테이블 타입
// ----------------------------------------------------------------

export interface BillingPlan {
  id: BillingPlanId;
  display_name: string;
  description: string | null;
  monthly_price: number;        // 월간 결제 금액 (원)
  annual_price_per_month: number; // 연간 결제 시 월 환산 금액 (원)
  max_students: number | null;  // null = 무제한
  max_sessions: number | null;  // null = 무제한 (4.5)
  features: BillingFeatureKey[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AcademySubscription {
  id: string;
  academy_id: string;
  plan_id: BillingPlanId;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;

  // 체험 기간
  trial_ends_at: string | null;

  // 현재 결제 구간
  current_period_start: string | null; // DATE 'YYYY-MM-DD'
  current_period_end: string | null;   // DATE 'YYYY-MM-DD'

  // 토스페이먼츠 자동결제
  toss_customer_key: string | null;
  toss_billing_key: string | null;

  // 카드 정보 (마스킹)
  card_company: string | null;
  card_number_masked: string | null; // 예: "****1234"

  // 취소
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  cancellation_reason: string | null;

  // 4.1 Dunning
  grace_period_end: string | null; // DATE 'YYYY-MM-DD'

  // 4.3 쿠폰/프로모
  promo_code: string | null;
  discount_percent: number | null;
  first_month_free: boolean;

  created_at: string;
  updated_at: string;

  // JOIN 관계 (선택적)
  billing_plans?: BillingPlan;
  academies?: {
    id: string;
    name_kr: string | null;
    name_en: string | null;
    contact_number?: string | null;
  };
}

export interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  academy_id: string;

  amount: number;              // 결제 금액 (원)
  billing_cycle: BillingCycle;
  period_start: string | null; // DATE 'YYYY-MM-DD'
  period_end: string | null;   // DATE 'YYYY-MM-DD'

  toss_payment_key: string | null;
  toss_order_id: string | null;

  status: PaymentStatus;
  failure_code: string | null;
  failure_message: string | null;
  retry_count: number;
  next_retry_at: string | null;

  paid_at: string | null;
  created_at: string;
}

export interface BillingWebhookEvent {
  id: string;
  event_id: string;
  event_type: string | null;
  processed_at: string;
  payload_snapshot: Record<string, unknown> | null;
}

// ----------------------------------------------------------------
// API 응답 타입
// ----------------------------------------------------------------

export interface BillingStats {
  total_subscriptions: number;
  active_subscriptions: number;
  trial_subscriptions: number;
  past_due_subscriptions: number;
  canceled_subscriptions: number;
  expired_subscriptions: number;
  mrr: number; // Monthly Recurring Revenue (원)
  arr: number; // Annual Recurring Revenue (원)
  by_plan: Record<BillingPlanId, number>;
  by_cycle: { monthly: number; annual: number };
  recent_payments: SubscriptionPayment[];
}

export interface SubscriptionListResponse {
  data: AcademySubscription[];
  total: number;
  page: number;
  limit: number;
}

export interface PaymentListResponse {
  data: SubscriptionPayment[];
  total: number;
  page: number;
  limit: number;
}

// ----------------------------------------------------------------
// 플랜 비교 유틸
// ----------------------------------------------------------------

export const PLAN_ORDER: Record<BillingPlanId, number> = {
  starter: 1,
  growth: 2,
  pro: 3,
};

export function isUpgrade(from: BillingPlanId, to: BillingPlanId): boolean {
  return PLAN_ORDER[to] > PLAN_ORDER[from];
}

export function getAnnualAmount(plan: BillingPlan): number {
  return plan.annual_price_per_month * 12;
}

export function getAnnualSavings(plan: BillingPlan): number {
  return plan.monthly_price * 12 - getAnnualAmount(plan);
}
