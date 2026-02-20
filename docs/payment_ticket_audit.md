# 결제·수강권 연동 점검 요약 (일반 사용자 Toss 결제)

> 학원관리자 플랫폼 구독(billing)과는 별개인, **일반 사용자 수강권 결제** 흐름에 대한 점검 결과입니다.

## 결제 수단 (Toss 전체 지원)

- **저장 코드**: `lib/toss/payment-method.ts`의 `getTossPaymentMethodCode()`로 Toss 응답 `method` + `easyPay.provider` 매핑  
  - 카드 → `TOSS_CARD`  
  - 가상계좌 → `TOSS_VIRTUAL_ACCOUNT`  
  - 계좌이체 → `TOSS_TRANSFER`  
  - 휴대폰 → `TOSS_MOBILE`  
  - 간편결제 → `TOSS_EASYPAY`, `TOSS_EASYPAY_KAKAO`, `TOSS_EASYPAY_TOSSPAY`, `TOSS_EASYPAY_NAVER`, `TOSS_EASYPAY_PAYCO` 등  
- **화면 표시**: `getPaymentMethodDisplayLabel()`로 결제내역(마이), academy-admin 매출 뷰에서 통일 표기.

## 1. 결제 플로우 (Toss Payments)

| 단계 | 경로 | 검증 내용 |
|------|------|-----------|
| 주문 생성 | `POST /api/tickets/payment-order` | ticketId, scheduleId(선택), countOptionIndex(선택) → orderId, amount, orderName 반환. `user_ticket_payment_orders`에 PENDING 저장. |
| 결제창 | 클라이언트 `requestPayment({ orderId, amount, orderName, successUrl, failUrl })` | 테스트 키: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` |
| 결제 승인 | `POST /api/tickets/payment-confirm` | paymentKey, orderId, amount 검증 → Toss confirm API 호출 → user_tickets 생성, revenue_transactions 저장(**transaction_date 설정**), schedule_id 있으면 수강권 차감 후 예약 생성. **이미 처리된 주문(PENDING 아님)이면 "이미 처리된 주문입니다" 반환(중복 방지)**. |
| 성공/실패 | `/payment/ticket/success`, `/payment/ticket/fail` | success에서 payment-confirm 호출 후 returnTo=session&sessionId 있으면 세션 성공 페이지로 이동. |

- **transaction_date**: payment-confirm·purchase 모두 `revenue_transactions` insert 시 `transaction_date` 설정함 → academy-admin 매출/대시보드 날짜 필터에 정상 반영.

## 2. 수강권 조회·표시

| 위치 | 데이터 소스 | 비고 |
|------|-------------|------|
| **마이페이지** | `GET /api/user-tickets` | getAvailableUserTickets / getAllUserTickets. Toss 결제로 생성된 user_tickets 동일하게 조회됨. |
| **마이페이지 수강권 요약** | 동일 API | ticketSummary (regular/popup/workshop, total). |
| **내 예약** | `GET /api/bookings` | payment-confirm에서 생성한 booking 포함. |
| **결제내역** | `GET /api/payment-history` | revenue_transactions + bookings. Toss 결제 건은 payment_method(TOSS_CARD 등) 포함, **결제 수단 라벨(카드/계좌이체 등) 표시** 추가됨. |
| **academy-admin 매출** | revenue_view, payment-logs, getRevenueTransactions | `payment_status = 'COMPLETED'`, `transaction_date` 기준 필터. Toss 결제 건 동일 노출. |
| **academy-admin 대시보드** | getDashboardStats | revenue_transactions 이번 달 합계에 Toss 결제 포함. |
| **academy-admin 예약/출결** | enrollments-view, student-view | bookings + user_tickets. Toss로 결제·예약한 건 동일 표시. |

## 3. 수강권 차감·예약

| 경로 | 동작 |
|------|------|
| **payment-confirm** (schedule_id 있음) | schedule → class_id 조회 → **consumeUserTicket 성공 시에만** booking 생성 및 schedules.current_students 갱신. 실패 시 결제만 완료, 예약은 생성하지 않음. |
| **POST /api/bookings** (기존 수강권으로 예약) | getAvailableUserTickets → consumeUserTicket → booking 생성. 수강권 없으면 400. |
| **예약 취소** (bookings/[id]/status) | COUNT 수강권이면 remaining_count +1, USED→ACTIVE 복원. |

- consumeUserTicket: PERIOD는 차감 없음, COUNT만 remaining_count 차감. 0이면 USED.

## 4. 보안·엣지 케이스

- **금액 검증**: payment-confirm에서 `order.amount === amount` 검사. 불일치 시 400.
- **주문 소유**: order 조회 시 `user_id = user.id` 조건. 타인 주문 접근 불가.
- **중복 승인**: order.status !== 'PENDING'이면 "이미 처리된 주문입니다" 반환, user_ticket/booking 재생성 없음.
- **Toss 승인 실패**: user_ticket_payment_orders.status = FAILED로 업데이트 후 에러 반환.

## 5. 수정·보완 사항 (이번 점검에서 반영)

1. **revenue_transactions.transaction_date**  
   - payment-confirm, purchase 모두 insert 시 `transaction_date` 설정 → academy 매출/대시보드 날짜 기준 집계에 포함.

2. **결제내역 결제 수단 표시**  
   - payment-history-view에서 TOSS_CARD → 카드, TOSS_TRANSFER → 계좌이체 등 라벨 표시.

3. **수강권 차감 실패 시 예약 미생성**  
   - payment-confirm에서 consumeUserTicket 실패 시 booking 생성하지 않음. 결제는 완료, 사용자는 마이페이지에서 직접 예약 가능.

## 6. 환경 변수

- `NEXT_PUBLIC_TOSS_CLIENT_KEY`: 결제창 클라이언트 키 (테스트: test_ck_...)
- `TOSS_SECRET_KEY`: 서버 결제 승인용 시크릿 키 (테스트: test_sk_...)
