# MOVEIT 구독·빌링 시나리오 (기존 스키마·API 기준)

이 문서는 구독 모델을 탄탄히 하기 위한 시나리오와, **이미 구현된 Supabase 스키마·API**를 기준으로 정리한 내용입니다.  
신규 설계 시 테이블명·컬럼명·API 경로는 아래와 동일하게 유지합니다.

---

## 0. 현재 스키마·API 요약 (기준)

### Supabase 테이블

| 테이블 | 역할 |
|--------|------|
| `billing_plans` | 요금제 정의 (id, display_name, monthly_price, annual_price_per_month, max_students, features, is_active, sort_order 등) |
| `academy_subscriptions` | 학원별 구독 1건. `academies(id)` 참조. |
| `subscription_payments` | 구독 결제 이력. `academy_subscriptions(id)`, `academies(id)` 참조. |

### academy_subscriptions 주요 컬럼

- **식별·플랜**: `id`, `academy_id`, `plan_id` (→ billing_plans.id), `billing_cycle` ('monthly' | 'annual')
- **상태**: `status` — `'card_only'` \| `'trial'` \| `'active'` \| `'past_due'` \| `'canceled'` \| `'expired'`
- **기간**: `trial_ends_at`, `current_period_start`, `current_period_end` (DATE)
- **토스페이먼츠**: `toss_customer_key`, `toss_billing_key` (빌링키)
- **카드 표시**: `card_company`, `card_number_masked` (마스킹만 저장)
- **취소**: `cancel_at_period_end`, `canceled_at`, `cancellation_reason`

### subscription_payments 주요 컬럼

- `subscription_id`, `academy_id`, `amount`, `billing_cycle`, `period_start`, `period_end`
- `toss_payment_key`, `toss_order_id` (멱등·중복 결제 방지)
- `status`: 'pending' | 'completed' | 'failed' | 'refunded'
- `failure_code`, `failure_message`, `retry_count`, `next_retry_at`, `paid_at`

### API (기존 구현)

- `GET /api/billing/subscription?academyId=...` — 학원 구독 1건 조회
- `GET /api/billing/plans` — 활성 요금제 목록 (billing_plans, is_active=true)
- `GET /api/billing/payments?academyId=...&page=1&limit=20` — 결제 이력
- `POST /api/billing/request-billing-auth` — 토스 빌링키 발급 후 academy_subscriptions에 저장 (카드 등록)
- `POST /api/billing/subscribe` — 구독 시작(첫 결제): academy_subscriptions 갱신 + subscription_payments INSERT + 토스 결제
- `POST /api/billing/change-plan` — 플랜/주기 변경 (업그레이드 즉시 결제, 다운그레이드 기간 종료 시 반영 등)
- `POST /api/billing/cancel` — cancel_at_period_end = true 설정 (기간 종료 시 취소)
- `POST /api/billing/webhook` — 토스 웹훅 수신 시 academy_subscriptions / subscription_payments 상태 반영

### 자동화 (Cron)

- `app/api/cron/auto-charge/route.ts` — 매일 결제 대상(active, current_period_end 도래) 조회 후 토스 빌링 결제 호출, 성공 시 subscription_payments INSERT 및 academy_subscriptions 기간 갱신, 실패 시 past_due 등 처리. **만료된 trial**(trial_ends_at <= 오늘)은 첫 결제 시도 후 성공 시 active, 실패 시 past_due 처리.

---

## 0.1 카드 등록 후 14일 무료 체험

일반 플랫폼과 동일하게 **카드 등록 완료 시점에 바로 14일 무료 체험**이 시작됩니다.

- **플로우**: 사용자가 "14일 무료 체험 시작" 등으로 플랜/주기 선택 → 토스 카드 등록 창 → 카드 등록 성공 → `POST /api/billing/request-billing-auth` 호출 시 서버에서 **신규 구독 행을 `status: 'trial'`**, `trial_ends_at = 오늘 + 14일`, 선택한 `plan_id`/`billing_cycle` 및 `current_period_start`/`current_period_end`(체험 기간)로 생성. 별도 "구독 시작" 버튼 없이 체험 이용 가능.
- **body**: `authKey`, `customerKey`, `academyId` 필수. 선택으로 `planId`, `billingCycle` 전달 시 해당 플랜으로 체험 시작(미전달 시 starter 월간).
- **체험 종료일**: `trial_ends_at` = 가입일 + 14일(마지막 무료 이용일). 예: 3월 1일 시작 시 3월 15일이 체험 종료일이면, 3월 15일까지 무료, **3월 16일부터** 유료 구독 시작.
- **체험 종료 후 자동 전환**: Cron(`/api/cron/auto-charge`)에서 `status = 'trial'` 이고 `trial_ends_at <= 오늘` 인 구독에 대해 **첫 결제 실행**. 성공 시 `status: 'active'`, `current_period_start`/`current_period_end`를 체험 종료일 다음날 기준으로 설정(월간이면 +1달, 연간이면 +1년), 이후부터 선택한 월간/연간 결제가 그대로 이어짐. 실패 시 `status: 'past_due'`, 재시도 로직 적용.
- **상수**: `lib/billing/constants.ts`에 `TRIAL_DAYS = 14`, `getTrialEndsAt()` (가입일 + 14일 DATE).

---

## 1. 월간/연간 자동 결제

자동 결제는 최초 결제 시 **빌링키(toss_billing_key)**를 발급받아, 서버가 주기적으로 토스페이먼츠 결제 API를 호출하는 방식입니다.

- **가맹점 직접 스케줄링**: 현재 방식. Cron(`/api/cron/auto-charge`)에서 `academy_subscriptions.status = 'active'` 이고 `current_period_end`가 오늘 이전인 행을 대상으로, `toss_billing_key`로 토스 빌링 결제를 요청합니다.
- **DB 저장**: `academy_subscriptions`에 `toss_billing_key`, `current_period_start`, `current_period_end`, `status`를 반드시 관리합니다. 결제 성공 시 `subscription_payments`에 한 건 INSERT하고, `academy_subscriptions`의 기간을 다음 주기로 갱신합니다.

---

## 2. 플랜 변경 (업그레이드/다운그레이드)

`POST /api/billing/change-plan` 및 `academy_subscriptions` 갱신으로 처리합니다.

- **업그레이드**: 상위 플랜으로 즉시 전환 가능. 필요 시 일할 계산(프로레이션) 후 차액 결제를 토스 빌링으로 요청하고, 성공 시 `plan_id`/`billing_cycle`/`current_period_*` 갱신 및 `subscription_payments`에 기록.
- **다운그레이드**: 즉시 환불보다는, `current_period_end`까지는 기존 플랜 유지하고, 다음 결제일부터 하위 플랜 금액으로 결제되도록 예약하는 방식이 일반적입니다. (필요 시 `scheduled_plan_id` 등 예약 컬럼 확장 검토.)
- **변경 이력**: 플랜 변경 로그는 `subscription_payments`에 결제 사유/메타를 남기거나, 별도 테이블(예: `subscription_plan_changes`)을 두어 추적할 수 있습니다. **현재는 기존 테이블명을 유지**하며, 필요 시 같은 스키마 내에서 컬럼만 추가하는 방식을 권장합니다.

---

## 3. 플랜 취소

`POST /api/billing/cancel` 및 `academy_subscriptions` 상태로 처리합니다.

- **즉시 권한 박탈 금지**: 사용자가 취소 요청 시 DB를 바로 '취소'로 두지 않고, `cancel_at_period_end = true`로 업데이트합니다. (이미 구현됨.)
- **권한 확인**: 서비스 접근 시 `current_date <= current_period_end`이면 이용 가능하게 처리합니다. `status`가 'active' 또는 'trial'이고 `cancel_at_period_end = true`인 경우에도 기간 만료 전까지는 동일하게 허용합니다.
- **종료일 도래**: Cron 또는 웹훅에서 `current_period_end`가 지난 구독을 감지하면 `status`를 `'canceled'`로 변경하고 `canceled_at`을 기록합니다. (현재 auto-charge 등에서 만료 처리 가능.)

---

## 4. 추가로 반드시 고민해야 하는 부분들 (Edge Cases) — 구현 계획

자동화 시스템을 완벽하게 구축하기 위해 아래 항목들을 **구현 계획**에 포함합니다.  
기존 테이블(`billing_plans`, `academy_subscriptions`, `subscription_payments`)과 API를 우선하며, 필요 시 최소한의 컬럼·테이블만 추가합니다.

---

### 4.1 결제 실패 및 더닝(Dunning) 프로세스

**목표**: 한도 초과·카드 만료 등으로 자동 결제가 실패해도 즉시 서비스를 끊지 않고, 유예 기간을 두고 재시도·안내를 수행한다.

| 단계 | 구현 계획 |
|------|------------|
| **유예 기간(Grace Period)** | `academy_subscriptions`에 `grace_period_end` (DATE, nullable) 추가. 결제 실패 시 `status = 'past_due'`로 두고, `grace_period_end = current_date + 7`(또는 3~7일 정책) 저장. 권한 체크 시 `current_date <= grace_period_end`이면 이용 허용 유지. |
| **실패 기록** | 이미 구현됨. `subscription_payments`에 `status = 'failed'`, `failure_code`, `failure_message`, `retry_count`, `next_retry_at` 저장. |
| **재시도** | Cron(`/api/cron/auto-charge` 또는 전용 `/api/cron/dunning-retry`)에서 `academy_subscriptions.status = 'past_due'` 이고 `subscription_payments.next_retry_at <= now()`인 건을 조회해, 1일 뒤·3일 뒤 등 정책에 따라 재결제 요청. `retry_count` 증가, 성공 시 `status = 'active'`, `grace_period_end` null 처리. |
| **안내 발송** | 결제 실패 시 이메일 또는 알림톡 발송. 학원 담당자 이메일은 `academies`/`users` 등 기존 테이블에서 조회. 발송 이력은 별도 알림 로그 테이블에 기록해도 되고, 초기에는 로그만 남겨도 됨. |

---

### 4.2 웹훅(Webhook) 처리 및 멱등성(Idempotency)

**목표**: PG(토스페이먼츠) 웹훅 중복 수신 시 중복 결제·권한 부여를 막고, 가짜 요청을 차단한다.

| 단계 | 구현 계획 |
|------|------------|
| **이벤트 ID 저장** | `billing_webhook_events` 테이블 추가 (id, event_id UNIQUE, event_type, processed_at, payload_snapshot 등). 또는 기존 `subscription_payments`에 `toss_event_id` 컬럼을 두고, 동일 orderId + event_id 조합이 있으면 스킵. |
| **멱등 처리** | 웹훅 수신 시 토스가 준 **이벤트 ID**(또는 paymentKey/orderId 조합)를 먼저 조회. 이미 존재하면 200 OK만 반환하고 처리 생략. 없으면 처리 후 event_id 저장. |
| **서명 검증** | 토스페이먼츠 웹훅 서명 검증 문서에 따라 요청 body + 시크릿으로 HMAC 등 검증. 검증 실패 시 401/400 반환. (`/api/billing/webhook` 내부에서 검증 로직 추가.) |

---

### 4.3 쿠폰 및 프로모션 처리

**목표**: '첫 달 무료', '1년간 10% 할인' 등 프로모션 코드를 적용한 최종 금액으로 PG에 결제 요청한다.

| 단계 | 구현 계획 |
|------|------------|
| **쿠폰·할인 구조** | **옵션 A**: `billing_coupons` 테이블 추가 (id, code, discount_type: 'percent' \| 'fixed' \| 'first_month_free', discount_value, valid_from, valid_until, max_redemptions 등). **옵션 B**: 기존 스키마만 쓰고 `academy_subscriptions`에 `promo_code`(VARCHAR), `discount_percent`(INTEGER), `first_month_free`(BOOLEAN) 등 최소 컬럼만 추가. |
| **결제 금액 계산** | `POST /api/billing/subscribe`, Cron 자동결제, `POST /api/billing/change-plan` 등에서 금액 계산 시 `billing_plans` 기준 금액에서 쿠폰/프로모션 할인을 적용한 `final_amount`를 산출 후 토스 API에 요청. 0원이면 결제 API 생략하고 기간만 갱신. |
| **사용 이력** | 쿠폰 1회 사용 제한 등이 필요하면 `academy_subscriptions`에 `applied_coupon_id` 또는 `subscription_payments`에 `coupon_id`를 두어 참조. |

---

### 4.4 관리자(Admin) 대시보드

**목표**: CS 대응을 위해 관리자가 특정 학원의 구독을 수동 취소·부분 환불·무료 기간 연장할 수 있게 한다.

| 기능 | 구현 계획 |
|------|------------|
| **수동 구독 취소** | Admin 전용 API 예: `PATCH /api/admin/billing/subscriptions/[id]` 또는 기존 admin billing 라우트 확장. `academy_subscriptions`의 `status = 'canceled'`, `canceled_at = now()` 설정. (이미 부분 구현된 admin billing 구독 목록/상세가 있다면 여기에 PATCH 추가.) |
| **부분 환불** | 토스 환불 API 호출 후 `subscription_payments`에 해당 건 `status = 'refunded'` 또는 별도 환불 이력 기록. Admin API에서 “결제 건 N번 부분 환불” 요청을 받아 처리. |
| **무료 이용 기간 연장** | `academy_subscriptions`의 `trial_ends_at` 또는 `current_period_end`를 Admin API에서 수정 가능하게. 예: `PATCH /api/admin/billing/subscriptions/[id]` body에 `{ "extend_period_end": "2025-03-31" }` 등. |

---

### 4.5 동시 접속 및 계정 공유 방지

**목표**: 구독 플랜에 따라 세션(또는 기기) 수를 제한하고, 초과 시 이전 세션 만료 또는 신규 로그인 차단한다.

| 단계 | 구현 계획 |
|------|------------|
| **플랜별 제한** | `billing_plans`에 `max_sessions` 또는 `max_devices` (INTEGER, nullable) 컬럼 추가. null이면 무제한. |
| **세션·기기 추적** | 기존 세션/기기 테이블이 있으면 활용. 없으면 `user_sessions`(user_id, device_id, academy_id, last_active_at 등) 테이블을 두고, 로그인·API 호출 시 upsert. |
| **권한 체크** | 학원 관리자 페이지 접근 시 해당 학원의 구독을 `academy_subscriptions` + `billing_plans`로 조회해 `max_sessions` 확인. 현재 해당 학원에 대한 활성 세션 수가 제한을 초과하면: 옵션 A) 가장 오래된 세션 만료 후 신규 허용, 옵션 B) 신규 로그인 차단하고 “기기 제한 초과” 메시지. |

---

위 4.1~4.5는 **구현 우선순위**를 정한 뒤 단계적으로 적용하면 됩니다. 스키마 확장이 필요한 경우에도 `billing_plans`, `academy_subscriptions`, `subscription_payments` 테이블명과 기존 컬럼은 유지합니다.

---

## 5. 정리

- **스키마·API**: 위 0절의 테이블명·컬럼명·API 경로를 기준으로 합니다. 신규 기능은 이 스키마와 호환되게 설계하고, 기존 코드(타입·API·Cron)를 우선합니다.
- **시나리오**: 1~4절은 위 스키마를 전제로 한 월간/연간 자동결제, 플랜 변경, 취소, edge case 대응 방향을 담고 있으며, 구현 시에도 동일한 테이블·API를 사용합니다.
