# MOVE.IT 코드 리뷰 및 E2E 디버깅 계획

작성일: 2026-06-16  
대상: 댄스학원 SaaS 운영 도구, 회원/비회원 수강권 구매, 수강신청, 입금확인, 환불, 출석, 관리자 운영 플로우  
상태: 수정 대기 문서. 이 문서는 코드 수정을 수행하지 않고, 고칠 지점과 검증 계획만 정리한다.

## 1. 총평

이 시스템은 기능 수는 많지만, 돈과 출석이 걸린 핵심 플로우가 아직 "제품으로 믿고 운영할 수 있는 상태"라고 보기 어렵다. 특히 Claude Code로 빠르게 확장된 시스템에서 자주 보이는 패턴, 즉 화면과 API는 많이 있지만 핵심 도메인 불변식이 한 곳에 모이지 않고 여러 라우트와 클라이언트 컴포넌트에 흩어진 상태가 강하게 보인다.

가장 위험한 축은 네 가지다.

1. 결제/입금확인/환불/예약/출석이 원자적 거래 단위로 묶이지 않은 곳이 많다.
2. 현재 E2E는 인증과 일부 인트로 플로우만 얕게 확인하며, 실제 돈이 오가는 플로우를 거의 검증하지 않는다.
3. 관리자 UI가 SaaS 운영 도구라기보다 모바일 카드형 화면에 가까워서, 상태 전환과 회계적 의미가 명확하지 않다.
4. 실패, 중복 클릭, 네트워크 재시도, 회원가입 후 비회원 데이터 병합 같은 운영 현실 시나리오가 테스트와 UX 양쪽에서 충분히 닫혀 있지 않다.

프로덕션 빌드와 타입체크는 통과했지만, 이건 "앱이 빌드된다"는 의미일 뿐이다. 수강권 발급, 수강신청, 환불, 출석이 서로 어긋나지 않는다는 보장은 아니다.

## 2. 이번 감사에서 확인한 것

| 항목 | 결과 | 메모 |
| --- | --- | --- |
| `npm.cmd run build` | 통과 | 최초 sandbox 실행은 Google Fonts 네트워크 접근 실패. 승인 후 재실행하여 성공. |
| `npx.cmd tsc --noEmit` | 통과 | 빌드 후 `.next/types` 생성 상태에서 성공. |
| `npm.cmd run lint` | 통과, 경고 다수 | `react-hooks/exhaustive-deps`, `<img>` 경고 다수. 결제 성공/예약/관리자 컴포넌트의 stale state 위험. |
| `npx.cmd playwright test --list` | 6개 테스트 확인 | 실제 핵심 플로우 실행은 보류. 외부 DB/결제/운영 데이터 변형 위험 때문에 전체 E2E 실행 전 격리 환경 필요. |
| 현재 E2E 범위 | 부족 | 관리자 페이지 로드, 인증 모달, 인트로 구독 정도. 수강권 구매, 입금확인, 환불, 출석, 게스트 병합은 실질적으로 미검증. |

빌드 중 `DYNAMIC_SERVER_USAGE` 로그가 여러 API 라우트에서 발생했다. 빌드는 성공하지만, `request.headers`, `cookies` 사용 라우트가 정적 렌더링 분석 중 동적 사용으로 포착되는 상태다. 운영 안정성과 빌드 로그 신뢰도를 위해 API 라우트의 dynamic 설정과 런타임 선언을 정리해야 한다.

## 3. 도메인 불변식

아래 불변식은 E2E와 리팩터링의 기준이다. 이 중 하나라도 깨지면 운영자가 돈, 수강권, 출석을 수동으로 맞춰야 한다.

1. 결제 완료된 주문은 정확히 하나의 수강권 발급 또는 명시적 실패/환불 상태로 귀결되어야 한다.
2. 계좌이체 입금확인은 정확히 한 번만 수강권, 매출, 예약 상태를 전환해야 한다.
3. 예약 하나는 한 명의 학생, 하나의 수업 회차, 하나의 결제/수강권 상태와 모순 없이 연결되어야 한다.
4. 카운트권은 예약 확정/출석/취소/환불에 따라 잔여 횟수가 절대 음수가 되거나 중복 복구되면 안 된다.
5. 기간권은 기간, 수업일, 출석 인정 범위, 환불 산식이 같은 시간대 기준으로 계산되어야 한다.
6. 환불은 결제사 취소, 매출 장부, 수강권 상태, 미래 예약 취소가 서로 맞아야 한다.
7. 출석 체크는 권한 있는 관리자/강사/키오스크만 수행할 수 있어야 하며, 학생이 자기 QR로 임의 출석 처리할 수 있으면 안 된다.
8. 비회원 주문은 회원가입 후 기존 결제/예약/수강권과 정확히 병합되어야 하며, 중복 발급이 없어야 한다.
9. 관리자가 보는 상태명은 회계적 의미와 일치해야 한다. "입금대기 되돌리기"가 실제로 환불/취소/삭제라면 UI에서 그렇게 보여야 한다.

## 4. P0: 즉시 막아야 할 고위험 이슈

### P0-1. QR 출석 체크 API의 권한 경계가 약하다

근거:
- `app/api/attendance/qr-checkin/route.ts:15` 인증 사용자를 가져온다.
- `app/api/attendance/qr-checkin/route.ts:23` authenticated Supabase 클라이언트를 사용한다.
- `app/api/attendance/qr-checkin/route.ts:73` QR 토큰과 booking의 user_id를 비교한다.
- `app/api/attendance/qr-checkin/route.ts:81` academyId 일치만 확인한다.
- `app/api/attendance/qr-checkin/route.ts:107` booking을 `COMPLETED`로 업데이트한다.
- 이 라우트에는 `assertAcademyAdmin` 또는 강사/키오스크 권한 확인이 보이지 않는다.

위험:
- RLS 설정에 따라 학생이 자신의 유효 QR 토큰과 academyId를 들고 직접 API를 호출해 셀프 출석을 만들 수 있다.
- 반대로 관리자 스캐너가 authenticated client의 RLS 때문에 업데이트 실패할 수도 있다.
- 출석 데이터는 환불 산식, 수업 운영, 강사 정산으로 이어질 가능성이 높으므로 권한 경계가 흐리면 매우 위험하다.

수정 방향:
- QR 체크인은 학생 인증이 아니라 관리자/강사/키오스크 권한으로만 가능해야 한다.
- API에서 `assertAcademyAdmin(academyId, authUser.id)` 또는 강사 권한 검증을 명시한다.
- 권한 검증 후 service-role 또는 보안 RPC로 출석 상태를 바꾼다.
- 학생이 호출하면 403, 다른 학원 QR이면 403, 만료/재사용 토큰이면 400/409로 명확히 분리한다.

필수 E2E:
- 회원이 자기 QR 토큰으로 `/api/attendance/qr-checkin` 직접 호출: 실패해야 한다.
- 관리자 QR 리더에서 정상 스캔: 성공해야 한다.
- 다른 학원 관리자 스캔: 실패해야 한다.
- 같은 QR 재사용: 두 번째 요청은 idempotent success 또는 409 중 하나로 고정한다.
- 이미 취소/환불된 booking의 QR: 실패해야 한다.

### P0-2. 예약 API가 클라이언트 입력만으로 결제 완료 예약을 만들 수 있는 경로가 있다

근거:
- `app/api/bookings/route.ts:124` 클라이언트 body에서 `paymentMethod`, `paymentStatus`를 받는다.
- `app/api/bookings/route.ts:135` `paymentMethod === 'card' || 'account' || 'CARD_DEMO'`를 즉시 결제로 취급한다.
- `app/api/bookings/route.ts:136` `paymentMethod === 'card'`를 카드 데모 결제로도 취급한다.
- `app/api/bookings/route.ts:349` 즉시 결제면 `user_ticket_id`가 null이어도 진행된다.
- `app/api/bookings/route.ts:350` 즉시 결제면 예약 상태가 `CONFIRMED`가 된다.

위험:
- 악의적 또는 버그 있는 클라이언트가 `paymentMethod: "card"`를 보내면 결제사 확인 없이 확정 예약을 만들 여지가 있다.
- 실제 결제 확정은 `/api/tickets/payment-confirm`의 Toss confirm 이후에만 발생해야 한다.
- "데모 결제" 경로가 운영 코드에 남아 있으면 수강권/매출/예약 불일치가 생긴다.

수정 방향:
- 운영 환경에서 `CARD_DEMO`와 `card` 직접 확정 경로를 제거하거나 feature flag로 막는다.
- 예약 확정은 이미 검증된 수강권 사용, 계좌이체 입금확인, Toss confirm 완료 중 하나만 허용한다.
- `paymentStatus`는 클라이언트 입력을 신뢰하지 말고 서버에서 산출한다.

필수 E2E:
- 로그인 회원이 API로 `paymentMethod: "card"`를 직접 보내는 요청: 400/403이어야 한다.
- 유효 수강권으로 예약: 확정, 잔여 횟수 차감.
- 수강권 없음 + 결제 미확정: 확정 예약 생성 불가.

### P0-3. 관리자 수강신청 삭제가 서버 도메인 로직을 우회한다

근거:
- `app/academy-admin/components/views/enrollments-view.tsx:446` `handleDelete`가 클라이언트에서 직접 삭제 흐름을 수행한다.
- `app/academy-admin/components/views/enrollments-view.tsx:461` `bookings`를 직접 delete 한다.
- `app/academy-admin/components/views/enrollments-view.tsx:477` `current_students`를 클라이언트에서 재계산해 업데이트한다.

위험:
- 예약 삭제가 출석, 수강권 잔여 횟수, 환불, 매출, 활동 로그, 감사 로그와 연결되지 않는다.
- 관리자가 실수로 삭제하면 고객에게는 결제/수강권이 남고 운영 화면에서는 신청이 사라지는 상태가 될 수 있다.
- 금융/출석 시스템에서 hard delete는 거의 항상 문제를 만든다.

수정 방향:
- 관리자 삭제 버튼은 원칙적으로 "취소" 또는 "환불" 플로우로 바꾼다.
- hard delete가 필요하면 서버 API에서 권한, 상태, 수강권 복구, 감사 로그를 모두 처리한다.
- `current_students`는 클라이언트 수동 갱신이 아니라 DB 함수/트리거/서버 API에서 계산한다.

필수 E2E:
- 관리자가 확정 예약을 삭제하려 할 때 환불/취소 선택지가 보여야 한다.
- 삭제/취소 후 회원의 수강권 잔여 횟수, 예약 목록, 관리자 통계가 일치해야 한다.
- 완료 출석 예약은 삭제 불가 또는 별도 정정 플로우만 허용해야 한다.

### P0-4. Toss 결제 확정 후 booking 생성 실패 시 돈과 수강권/예약이 어긋날 수 있다

근거:
- `app/api/tickets/payment-confirm/route.ts:252` `user_tickets`를 먼저 insert 한다.
- `app/api/tickets/payment-confirm/route.ts:336` 이후 revenue를 insert 한다.
- `app/api/tickets/payment-confirm/route.ts:444` 예약용 티켓을 소비한다.
- `app/api/tickets/payment-confirm/route.ts:483` 소비 실패 시 예약을 만들지 않는 분기만 있고 전체 거래는 이미 진행 중이다.
- `app/api/tickets/payment-confirm/route.ts:494` booking insert가 뒤에 온다.

위험:
- 결제는 성공했고 수강권도 발급됐는데 예약 insert가 실패하면 사용자는 "결제했는데 신청 안 됨" 상태가 된다.
- 1회권이면 예약을 만들기 전에 잔여 횟수가 0 또는 USED가 될 수 있다.
- 일부 rollback은 있지만 모든 단계가 하나의 DB transaction으로 묶여 있지 않다.

수정 방향:
- 결제 confirm 이후 DB 변경은 RPC/transaction으로 묶는다.
- `payment_orders`, `user_tickets`, `revenue_transactions`, `bookings`, 잔여 횟수 차감을 하나의 원자 단위로 처리한다.
- 결제사 confirm 성공 후 DB 실패는 outbox/reconciliation 테이블에 반드시 남겨 운영자가 복구할 수 있게 한다.

필수 E2E:
- Toss confirm 성공 후 booking insert 실패를 강제로 유도: 시스템은 자동 환불, 복구 큐, 또는 재시도 가능 상태 중 하나로 귀결되어야 한다.
- 동일 `orderId` confirm 두 번 호출: 수강권/매출/예약이 정확히 1개만 생성되어야 한다.
- 1회권 결제+예약 중 실패: 잔여 횟수가 소실되지 않아야 한다.

### P0-5. 계좌이체 입금확인도 여러 DB 쓰기가 원자적이지 않다

근거:
- `app/api/academy-admin/[academyId]/bank-transfer-confirm/route.ts:56` 주문을 `PENDING -> CONFIRMED`로 claim 한다.
- `app/api/academy-admin/[academyId]/bank-transfer-confirm/route.ts:165` `user_tickets`를 insert 한다.
- `app/api/academy-admin/[academyId]/bank-transfer-confirm/route.ts:216` revenue를 insert 한다.
- `app/api/academy-admin/[academyId]/bank-transfer-confirm/route.ts:281` 예약용 티켓을 소비한다.
- `app/api/academy-admin/[academyId]/bank-transfer-confirm/route.ts:356` booking을 insert 한다.

위험:
- claim, 수강권 발급, 매출 생성, 예약 확정 중간에서 실패하면 상태가 갈라진다.
- 관리자 더블클릭/재시도/네트워크 지연 시 멱등성이 완전히 보장되어야 한다.
- 운영자에게는 입금확인 성공으로 보이는데 실제 예약이 없거나 수강권만 남는 상태가 생길 수 있다.

수정 방향:
- 입금확인은 DB RPC 하나로 처리한다.
- order id 기준 unique/idempotency key를 강제한다.
- `CONFIRMED` 상태만 바꾸는 것이 아니라 수강권, 매출, 예약 링크까지 모두 성공해야 성공 응답을 반환한다.

필수 E2E:
- 관리자 두 명이 같은 주문을 동시에 입금확인: 하나만 성공해야 한다.
- 입금확인 버튼 더블클릭: 수강권/매출/예약 중복 생성 없어야 한다.
- 입금확인 중 booking 실패: order는 `PENDING` 또는 `NEEDS_REVIEW`로 남아야 한다.

### P0-6. 회원가입 후 비회원 데이터 병합의 멱등성 검증이 부족하다

근거:
- `app/api/me/link-guest-bookings/route.ts:162` confirmed 계좌이체 주문에 대해 retroactive ticket issue를 수행한다.
- `app/api/me/link-guest-bookings/route.ts:171` `user_ticket_id`가 null인 주문을 대상으로 한다.
- `app/api/me/link-guest-bookings/route.ts:206` `user_tickets`를 insert 한다.
- `app/api/me/link-guest-bookings/route.ts:226` revenue를 insert 한다.
- `app/api/me/link-guest-bookings/route.ts:423` 로그인/회원가입 시 병합을 호출한다.

위험:
- 회원가입 직후 네트워크 재시도, 탭 중복, 앱 재진입이 발생하면 retro issue가 중복 실행될 수 있다.
- 게스트 user 삭제/병합 중 일부 테이블만 갱신되면 예약은 회원에게 보이지만 수강권/매출은 게스트에 남을 수 있다.

수정 방향:
- guest merge와 retro issue를 DB transaction으로 묶는다.
- order id, guest user id, user id 기준 unique 제약과 idempotency key를 둔다.
- 병합 결과를 상세 리포트로 반환하고 UI에서 "가져온 예약/수강권"을 보여준다.

필수 E2E:
- 비회원 계좌이체 주문 후 관리자 입금확인, 이후 같은 전화번호로 회원가입: 수강권/예약/매출이 정확히 1회 연결되어야 한다.
- 회원가입 완료 페이지 refresh 3회: 중복 발급 없어야 한다.
- 기존 회원 이메일/전화번호와 충돌하는 비회원 구매: 로그인 안내와 병합 정책이 명확해야 한다.

## 5. P1: 운영 안정성 이슈

### P1-1. 환불은 결제사 취소 이후 부분 실패를 견딜 수 있어야 한다

근거:
- `app/api/academy-admin/[academyId]/ticket-refund/route.ts:199` claim update.
- `app/api/academy-admin/[academyId]/ticket-refund/route.ts:219` Toss cancel 호출.
- `app/api/academy-admin/[academyId]/ticket-refund/route.ts:253` 결제사 취소 후에는 되돌릴 수 없다는 주석 흐름.
- `app/api/academy-admin/[academyId]/ticket-refund/route.ts:257` 미래 예약 취소.
- `app/api/academy-admin/[academyId]/ticket-refund/route.ts:296` user_ticket `REFUNDED` 업데이트.

문제:
- Toss 취소 성공 후 내부 DB 업데이트 일부가 실패하면 외부 결제와 내부 운영 상태가 갈라진다.

필수 조치:
- 환불 요청을 `PENDING_REFUND -> PG_CANCELLED -> INTERNAL_SETTLED` 같은 상태 머신으로 관리한다.
- 실패 시 `NEEDS_RECONCILIATION`으로 남기고 관리자에게 복구 액션을 제공한다.
- 환불은 삭제가 아니라 음수 매출 또는 refund ledger로 남긴다.

### P1-2. "입금대기 되돌리기"의 의미가 위험하게 모호하다

근거:
- `app/api/academy-admin/[academyId]/bank-transfer-revert/route.ts`는 confirmed order를 pending으로 되돌리며 booking/user_ticket/revenue를 정리한다.

문제:
- UI 문구는 단순 되돌리기처럼 보이지만, 실제로는 발급된 수강권과 매출을 삭제/취소하는 회계 행위다.
- 이미 실제 현금 입금이 들어온 상태에서 시스템만 PENDING으로 되돌리면 현금과 장부가 불일치한다.

필수 조치:
- "입금확인 취소"와 "환불 처리"를 분리한다.
- 실제 환불 여부, 환불 수단, 환불일, 메모, 담당자를 기록한다.
- 되돌리기는 입금확인 직후 실수 정정용으로 제한하고 감사 로그를 필수화한다.

### P1-3. 입금확인 화면의 optimistic UI가 운영자를 속일 수 있다

근거:
- `app/academy-admin/components/views/deposit-confirm-view.tsx:183` revert handler.
- `app/academy-admin/components/views/deposit-confirm-view.tsx:185` API 성공 전 UI 상태를 먼저 바꾼다.
- `app/academy-admin/components/views/deposit-confirm-view.tsx:214` confirm handler.
- `app/academy-admin/components/views/deposit-confirm-view.tsx:215` 확인 전 UI 상태를 먼저 바꾼다.
- `app/academy-admin/components/views/deposit-confirm-view.tsx:224` 이후 API 요청.

문제:
- 관리자는 이미 확인된 것처럼 보는데 서버에서 실패할 수 있다.
- 돈 관련 화면에서는 optimistic UI보다 명확한 pending, success, failure 피드백이 맞다.

필수 조치:
- API 성공 전에는 row 상태를 "처리 중"으로만 표시한다.
- 성공 응답에 포함된 order/userTicket/booking/revenue id를 UI에 반영한다.
- 실패 시 어떤 단계에서 실패했는지 보여주고 retry/reconcile 액션을 제공한다.

### P1-4. lint 경고로 드러난 stale state 위험

주요 파일:
- `app/(main)/book/session/[sessionId]/session-booking-view.tsx`
- `app/(main)/payment/ticket/success/page.tsx`
- `app/academy-admin/components/...`

문제:
- hook dependency 누락은 결제 성공 페이지, 예약 화면, 관리자 화면에서 오래된 searchParams/session/user/ticket 상태를 사용할 수 있다.
- 결제/예약 플로우에서는 한 번의 stale closure가 중복 confirm 또는 잘못된 orderId confirm으로 이어질 수 있다.

필수 조치:
- 핵심 플로우부터 exhaustive-deps 경고를 제거한다.
- 의도적으로 dependency를 제외한 경우는 ref/useEvent 패턴으로 명시한다.

### P1-5. API 라우트 dynamic/runtime 선언 정리가 필요하다

빌드 로그에서 동적 사용으로 포착된 주요 라우트:
- `/api/admin/stats`
- `/api/admin/billing/stats`
- `/api/admin/billing/subscriptions`
- `/api/academies/search`
- `/api/admin/push/scenario-data`
- `/api/billing/payments`
- `/api/billing/subscription`
- `/api/instructor/me`
- `/api/notifications`
- `/api/instructor/my-schedule`
- `/api/tickets`

필수 조치:
- cookies/headers/request body를 쓰는 API는 `export const dynamic = 'force-dynamic'` 등으로 의도를 명시한다.
- middleware에서 Supabase Edge runtime 경고가 나는 import trace도 정리한다.

### P1-6. 수강권/예약 상태 전이가 여러 곳에 흩어져 있다

문제:
- `/api/bookings`
- `/api/tickets/payment-confirm`
- `/api/tickets/bank-transfer-order`
- `/api/academy-admin/[academyId]/bank-transfer-confirm`
- `/api/academy-admin/[academyId]/bank-transfer-revert`
- `/api/academy-admin/[academyId]/ticket-refund`
- `/api/me/link-guest-bookings`

위 라우트들이 각각 수강권, 예약, 매출, 학생 등록을 직접 만진다.

필수 조치:
- `confirmTicketPayment`
- `confirmBankTransfer`
- `createBookingWithTicket`
- `cancelBookingAndRestoreTicket`
- `refundTicket`
- `mergeGuestIdentity`

이런 도메인 유스케이스를 서버/RPC 레이어로 모아야 한다.

## 6. 비회원 E2E 시나리오

### 6.1 비회원 기본 퍼널

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| G-01 | 비회원이 수업 상세 진입 | 수업 정보, 가격, 남은 자리, 로그인/비회원 신청 CTA가 명확해야 한다. |
| G-02 | 비회원이 1회권 카드 결제 + 특정 수업 신청 | Toss confirm 후 수강권 1개, 예약 1개, 매출 1개가 생성되고 예약은 확정되어야 한다. |
| G-03 | G-02 이후 회원가입 | 동일 전화번호/이메일 기준으로 기존 예약과 수강권이 회원 계정에 병합되어야 한다. |
| G-04 | 비회원이 계좌이체로 1회권 신청 | 예약은 `PENDING`, 주문은 `PENDING`, 관리자 입금확인 전까지 출석/확정 불가. |
| G-05 | G-04 관리자 입금확인 | 주문, 수강권, 매출, 예약이 한 번에 확정되어야 한다. |
| G-06 | G-05 이후 회원가입 | 수강권/예약/매출이 정확히 한 번 연결되어야 한다. |
| G-07 | 비회원이 다회권/기간권 구매 시도 | 정책상 허용하지 않는다면 명확히 차단하고 회원가입/로그인 CTA를 보여야 한다. |
| G-08 | 기존 회원 전화번호로 비회원 구매 시도 | "이미 가입된 정보"를 안내하고 로그인 플로우로 보내야 한다. |
| G-09 | 기존 회원 이메일로 비회원 구매 시도 | 동일. 이메일/전화번호 중 하나라도 충돌 시 병합/로그인 정책이 명확해야 한다. |
| G-10 | 비회원이 같은 수업을 같은 전화번호로 중복 신청 | 중복 예약/중복 주문이 생기면 안 된다. |
| G-11 | 비회원이 결제창에서 취소 | 주문/예약/수강권/매출이 남지 않거나 명확한 `CANCELLED/FAILED` 상태여야 한다. |
| G-12 | 비회원 결제 성공 후 성공 페이지 새로고침 | 중복 수강권/예약/매출이 생기면 안 된다. |
| G-13 | 비회원 계좌이체 주문 후 관리자가 입금확인 전 취소 | 예약, 주문, UI 상태가 일관되어야 한다. |
| G-14 | 비회원 계좌이체 주문 후 다른 브라우저에서 회원가입 | 병합 결과가 모바일/데스크톱 모두에서 동일해야 한다. |

### 6.2 비회원 예외 케이스

- 전화번호 형식 불일치: `010-1234-5678`, `01012345678`, 공백 포함이 같은 사람으로 매칭되어야 한다.
- 이메일 대소문자: `USER@X.COM`과 `user@x.com`은 같은 사람으로 취급해야 한다.
- 한국 시간 자정 근처 결제: 결제일, 수강일, 환불 산식이 KST 기준으로 맞아야 한다.
- 비회원 예약을 관리자가 수동 출석 처리하려 할 때: 회원 user_id가 없어도 정책적으로 가능한지 명확해야 한다.
- 비회원 환불: 회원가입 전/후 모두 환불 가능해야 하며, 환불 내역이 고객과 관리자 양쪽에서 추적되어야 한다.

## 7. 회원 E2E 시나리오

### 7.1 수강권 구매와 수강신청

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| M-01 | 회원이 1회권 카드 구매 후 수업 예약 | 수강권 발급, 잔여 1 -> 0, 예약 확정. |
| M-02 | 회원이 다회권 구매 후 여러 회차 예약 | 잔여 횟수가 예약 수만큼 차감되고 중복 예약이 막혀야 한다. |
| M-03 | 회원이 기간권 구매 후 기간 내 수업 예약 | 기간 내 회차만 예약 가능. |
| M-04 | 기간권으로 기간 밖 수업 예약 시도 | 차단되어야 한다. |
| M-05 | 특정 클래스 전용 수강권으로 다른 클래스 예약 | 차단되어야 한다. |
| M-06 | 일반 수강권으로 허용 클래스 예약 | 성공해야 한다. |
| M-07 | 정원 마감 수업 예약 시도 | 예약 실패, 잔여 횟수 차감 없어야 한다. |
| M-08 | 과거 수업 예약 시도 | 차단되어야 한다. |
| M-09 | 취소된 수업 예약 시도 | 차단되어야 한다. |
| M-10 | 같은 수업 중복 예약 | 중복 booking이 생기면 안 된다. |
| M-11 | 예약 취소 + 수강권 복구 | 상태는 `CANCELLED`, 잔여 횟수 복구는 정확히 한 번만. |
| M-12 | 예약 취소 버튼 더블클릭 | 잔여 횟수 중복 복구 없어야 한다. |

### 7.2 결제 실패와 멱등성

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| M-13 | Toss confirm 성공 후 성공 페이지 refresh | 발급/매출/예약 1개만 유지. |
| M-14 | Toss confirm API를 같은 orderId로 두 번 호출 | idempotent response. |
| M-15 | Toss confirm 실패 | 수강권/매출/예약 생성 없음. 주문은 실패 상태. |
| M-16 | 결제 성공, booking insert 실패 강제 | 자동 복구 또는 `NEEDS_REVIEW` 상태가 남아야 한다. |
| M-17 | 결제 성공 후 네트워크 끊김 | 재진입 시 기존 결과를 조회해서 보여야 한다. |

### 7.3 회원 대시보드

- 구매한 수강권, 남은 횟수, 사용 완료, 환불 상태가 일관되게 보여야 한다.
- 예약 목록에서 입금대기/확정/출석완료/취소 상태가 고객 언어로 명확해야 한다.
- 환불된 수강권으로 새 예약을 할 수 없어야 한다.
- 계좌이체 입금대기 예약은 출석 QR을 만들 수 없어야 한다.
- 고객이 "내가 결제했는데 신청이 없다"를 스스로 인지하고 문의할 수 있는 안내가 있어야 한다.

## 8. 학원관리자 E2E 시나리오

### 8.1 입금확인

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| A-01 | 입금대기 주문 목록 조회 | 주문자, 입금자명, 전화번호, 수업, 금액, 신청일, 중복 의심 여부가 보여야 한다. |
| A-02 | 정상 입금확인 | order/user_ticket/revenue/booking id가 모두 생성되고 UI가 성공 상태로 갱신. |
| A-03 | 입금확인 더블클릭 | 중복 발급 없음. 버튼은 처리 중 비활성화. |
| A-04 | 관리자 2명이 동시에 확인 | 한 명만 성공. 다른 쪽은 이미 처리됨으로 표시. |
| A-05 | 입금확인 중 DB 일부 실패 | `NEEDS_REVIEW` 또는 원복 상태. 운영자에게 복구 안내. |
| A-06 | 확인 후 되돌리기 | 실제 현금 환불 여부와 회계 로그가 남아야 한다. |
| A-07 | 되돌리기 더블클릭 | 중복 삭제/중복 복구 없음. |
| A-08 | 입금자명 불일치 | 확인 전 경고 또는 메모 입력. |
| A-09 | 주문 금액과 입금 금액 불일치 | 부분입금/초과입금 상태를 표시해야 한다. |

### 8.2 수강신청/예약 관리

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| A-10 | 관리자가 회원을 수업에 수동 추가 | 권한, 정원, 중복, 수강권 처리 정책이 명확해야 한다. |
| A-11 | 관리자가 비회원을 수동 추가 | 전화번호/이메일 중복 체크, 이후 회원가입 병합 가능. |
| A-12 | 예약 상태를 확정/취소/출석완료로 변경 | 수강권/출석/통계가 함께 갱신. |
| A-13 | 예약 삭제 시도 | hard delete 대신 취소/환불/정정 플로우로 유도. |
| A-14 | 완료 출석 예약 취소 | 환불 산식과 출석 취소 로그가 필요. |
| A-15 | 정원 초과 수동 추가 | 명시적 override 권한과 로그가 있어야 한다. |

### 8.3 환불

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| A-16 | 사용 전 1회권 전액 환불 | PG 취소, 수강권 REFUNDED, 예약 취소, refund ledger 생성. |
| A-17 | 일부 사용 다회권 환불 | 사용 횟수/남은 횟수/법정 산식이 일치. |
| A-18 | 기간권 중도 환불 | KST 기준 이용일수 계산. |
| A-19 | 이미 출석완료된 예약이 있는 환불 | 완료 출석은 보존, 미래 예약만 취소. |
| A-20 | Toss 취소 성공 후 내부 DB 실패 | 운영자가 볼 수 있는 reconciliation 상태가 남아야 한다. |
| A-21 | 오프라인/계좌이체 환불 | 실제 송금 여부, 송금일, 담당자, 메모가 필요. |
| A-22 | 환불 모달 dry-run | 실제 환불 전 계산 근거가 보여야 한다. |

### 8.4 출석

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| A-23 | 관리자 QR 스캔 정상 출석 | 예약 `COMPLETED`, 출석 로그 생성. |
| A-24 | 학생이 직접 QR checkin API 호출 | 실패. |
| A-25 | 다른 학원 QR 스캔 | 실패. |
| A-26 | 만료 QR 스캔 | 실패. |
| A-27 | 같은 QR 재스캔 | 멱등 처리 또는 이미 출석 안내. |
| A-28 | 취소/환불 예약 QR 스캔 | 실패. |
| A-29 | 관리자가 수동 출석 처리 | 권한, 로그, 환불 산식 반영. |
| A-30 | 결석 처리 | 상태, 수강권 차감 정책, 고객 노출이 명확해야 한다. |

## 9. 디자인, UI/UX, 고객 퍼널 지적

### 9.1 관리자 SaaS 화면의 성격

현재 관리자 화면은 카드, rounded, 넓은 여백, native alert/confirm 패턴이 많이 보인다. 댄스학원 SaaS 운영 화면은 감성 랜딩이 아니라 반복 업무 도구다. 운영자는 하루에 수십 건의 신청, 입금, 취소, 환불을 훑어야 하므로 아래 방향이 맞다.

- 입금확인/수강신청/환불은 테이블 중심이어야 한다.
- 상태 badge는 색만이 아니라 문구와 회계 의미가 명확해야 한다.
- row 클릭 시 상세 drawer에서 주문, 결제, 수강권, 예약, 로그를 한 번에 보여야 한다.
- `alert()`/`confirm()` 대신 전용 확인 모달, 위험 액션 문구, 담당자 메모, 처리 결과 toast를 사용한다.
- 처리 중 버튼은 반드시 disabled + spinner + row lock을 제공한다.
- 위험 액션은 optimistic UI를 쓰지 않는다.
- "되돌리기", "삭제" 같은 단어 대신 "입금확인 취소", "예약 취소", "환불 처리", "정정 기록"처럼 실제 효과를 말한다.

### 9.2 고객 퍼널

비회원 퍼널에서 가장 중요한 것은 "가입 전에도 1회 체험/특강을 쉽게 신청하되, 결제 후 회원 전환이 매끄러운 것"이다.

필수 개선:
- 비회원 신청 완료 후 "회원가입하면 예약과 수강권을 자동으로 가져옵니다"를 명확히 보여준다.
- 회원가입 폼은 비회원 주문의 이름/전화번호/이메일을 prefill 해야 한다.
- 로그인으로 전환하는 경우에도 returnTo가 유지되어야 한다.
- 이미 가입된 전화번호/이메일이면 "비회원으로 다시 결제"보다 "로그인 후 이어가기"가 우선이어야 한다.
- 결제 성공 페이지에서는 예약 상태, 입금 상태, 수업 날짜, 환불/문의 경로를 바로 보여야 한다.

### 9.3 심미성과 신뢰감

돈을 받는 SaaS에서 미감은 장식보다 신뢰감이다.

- 밝은 primary 색상 위 흰 글자 조합은 대비를 재검토해야 한다.
- 관리자 화면의 `rounded-2xl`, blur, gradient 사용은 줄이고, 밀도 있고 차분한 데이터 UI로 간다.
- 상태 색상은 빨강/노랑/초록만 쓰지 말고, 위험/대기/확정/완료/환불/정정의 의미 체계를 통일한다.
- 모바일에서는 카드가 필요하지만, 데스크톱 운영 화면은 스캔 가능한 테이블과 고정 액션 영역이 우선이다.
- 다크모드는 결제/상태 badge 대비를 별도로 검증한다.

## 10. E2E 테스트 하네스 설계

### 10.1 격리 환경

실제 E2E를 바로 운영 DB에 붙이면 안 된다. 아래가 먼저 필요하다.

- 전용 Supabase staging 프로젝트 또는 매 테스트 transaction rollback이 가능한 로컬 Supabase.
- 테스트 전용 academy, branch, hall, class, schedule seed.
- 테스트 전용 관리자, 회원, 강사, 비회원 fixture.
- Toss 결제 mock 서버 또는 API 라우트 레벨 mock.
- 계좌이체는 외부 의존이 없으므로 seed order 기반으로 검증.
- 테스트 후 bookings, user_tickets, orders, revenue, attendance logs 정리.

### 10.2 테스트 데이터 세트

필수 fixture:
- 학원 A: 정상 운영 학원.
- 학원 B: 권한 분리 검증용 다른 학원.
- 수업 1: 정원 여유 있음.
- 수업 2: 정원 1명, sold out 검증.
- 수업 3: 과거 수업.
- 수업 4: 취소된 수업.
- 수강권 1: 비회원 허용 1회권.
- 수강권 2: 회원 전용 4회권.
- 수강권 3: 30일 기간권.
- 수강권 4: 특정 클래스 전용권.
- 회원 U1: 수강권 없음.
- 회원 U2: 다회권 보유.
- 회원 U3: 기간권 보유.
- 관리자 AdminA: 학원 A 권한.
- 관리자 AdminB: 학원 B 권한.
- 강사 I1: 학원 A 강사.

### 10.3 Playwright 구조

권장 파일:
- `tests/e2e/guest-booking.spec.ts`
- `tests/e2e/member-ticket-booking.spec.ts`
- `tests/e2e/admin-deposit-confirm.spec.ts`
- `tests/e2e/refund.spec.ts`
- `tests/e2e/attendance.spec.ts`
- `tests/e2e/guest-merge.spec.ts`
- `tests/e2e/admin-ux-regression.spec.ts`

권장 도우미:
- `tests/helpers/seed.ts`
- `tests/helpers/auth.ts`
- `tests/helpers/toss-mock.ts`
- `tests/helpers/db-assert.ts`
- `tests/helpers/time.ts`

테스트는 UI assertion만으로 끝내면 안 된다. 각 핵심 플로우 후 DB assertion을 같이 해야 한다.

예:
- booking count
- user_ticket count/status/remaining_count
- revenue transaction amount/status
- bank_transfer_order status/user_ticket_id/booking_id
- attendance log
- activity log

## 11. 디버깅 및 수정 순서

### Phase 0. 안전장치

1. staging DB 또는 local Supabase를 만든다.
2. 운영 데이터와 완전히 분리된 seed를 만든다.
3. Toss는 실제 결제 대신 mock으로 고정한다.
4. 위험 API 테스트는 DB assertion과 teardown을 붙인다.
5. 로그에 request id, user id, academy id, order id, booking id를 남긴다.

### Phase 1. P0 재현 테스트 먼저 작성

수정 전 반드시 실패하는 테스트를 만든다.

1. 학생 셀프 QR 출석 API 호출.
2. `paymentMethod: "card"` 직접 booking 생성.
3. 관리자 booking hard delete 후 수강권/통계 불일치.
4. Toss confirm 중 booking insert 실패.
5. 계좌이체 입금확인 더블클릭.
6. 회원가입 후 비회원 주문 병합 중복 실행.

### Phase 2. 도메인 트랜잭션화

1. payment confirm transaction/RPC.
2. bank transfer confirm transaction/RPC.
3. refund state machine.
4. booking cancel/restore server API.
5. guest merge transaction/RPC.
6. attendance checkin 권한 boundary.

### Phase 3. 관리자 UX 재설계

1. 입금확인 테이블: pending/confirmed/reverted/needs review 탭.
2. 환불 drawer: 계산 근거, PG 취소, 내부 정산 상태.
3. 예약 상세 drawer: 고객, 수업, 수강권, 결제, 로그.
4. 위험 액션 모달: 담당자 메모 필수.
5. toast/inline error 정리.

### Phase 4. 전체 회귀

1. 회원/비회원 happy path.
2. 실패/중복/재시도 path.
3. 관리자 권한 분리.
4. 모바일 WebView 결제 복귀.
5. desktop 관리자 테이블 UX.
6. 다크모드/대비/반응형.

## 12. 첫 번째 PR로 끊을 범위

첫 PR은 기능 추가가 아니라 안전성 확보가 목적이어야 한다.

추천 범위:
1. QR checkin 권한 검증 강화.
2. `/api/bookings`의 클라이언트 결제 신뢰 경로 제거.
3. 관리자 booking hard delete 제거 또는 서버 취소 API로 대체.
4. 위 3개에 대한 E2E/API 테스트 추가.

두 번째 PR:
1. 계좌이체 confirm transaction화.
2. deposit-confirm UI의 optimistic 상태 변경 제거.
3. 더블클릭/동시처리 E2E.

세 번째 PR:
1. Toss payment-confirm transaction화.
2. idempotency/reconciliation 추가.
3. 결제 성공 페이지 refresh/재진입 E2E.

네 번째 PR:
1. refund state machine.
2. dry-run 계산 검증.
3. PG 취소 후 내부 실패 복구 플로우.

다섯 번째 PR:
1. guest merge transaction화.
2. 회원가입 후 병합 UX.
3. 비회원 계좌이체/카드 주문 병합 E2E.

## 13. 완료 기준

운영 투입 전 최소 기준:

- P0 항목 전부 수정.
- 핵심 E2E 40개 이상 통과.
- 결제/입금확인/환불/출석 플로우는 UI assertion + DB assertion 동시 검증.
- lint의 핵심 플로우 hook dependency 경고 제거.
- `npm.cmd run build`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npx.cmd playwright test` 통과.
- 실패한 결제/환불/입금확인은 운영자가 복구 가능한 상태로 남는다.
- 관리자 화면에서 모든 돈 관련 액션은 감사 로그와 담당자 메모를 남긴다.
- 비회원에서 회원 전환 시 예약/수강권 중복 발급이 없어야 한다.

## 14. 결론

이 시스템은 화면과 플로우의 양은 충분하지만, 지금 당장 필요한 것은 더 많은 기능이 아니라 돈, 수강권, 예약, 출석을 절대 어긋나지 않게 만드는 것이다. 특히 비회원 퍼널은 매출 전환에 중요하지만, 회원가입 후 병합과 입금확인/환불까지 완전히 닫히지 않으면 운영자가 매일 수동 정산을 하게 된다.

수정은 P0부터 작게 끊되, 테스트는 실제 사용자/관리자 시나리오 기준으로 넓게 깔아야 한다. 이 문서를 기준으로 다음 작업은 "P0 재현 테스트 작성 -> P0 수정 -> DB assertion으로 검증" 순서가 맞다.
