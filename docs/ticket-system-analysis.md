# 수강권 시스템 상세 분석 (기간제·쿠폰제·워크샵)

> 2025년 2월 점검 - 유저뷰·관리자 관점 통합

---

## 1. 구매 이력 (Purchase History)

### 1-1. 유저뷰

| 항목 | 구현 상태 | 비고 |
|------|----------|------|
| **결제내역 화면** | ❌ 미동작 | `/payment-history` - `PaymentHistoryView`가 `setPayments([])`로 항상 빈 배열 설정. "인증 기능 제거로 인해" 주석 존재 |
| **수강권 구매 기록** | ❌ 미표시 | `revenue_transactions`는 학원별로만 조회되며, 유저 전용 API 없음 |
| **예약·수강권 사용 기록** | ⚠️ 제한적 | `/api/bookings`로 예약 목록은 있으나, "수강권 사용" vs "결제" 구분 표시 없음 |
| **유형별 구분** | - | 기간제/쿠폰/워크샵 구매 이력 구분 없음 |

**문제점:** 유저가 자신의 수강권·결제 이력을 한곳에서 조회할 수 있는 화면이 없음.

---

### 1-2. 관리자 관점

| 항목 | 구현 상태 | 비고 |
|------|----------|------|
| **매출/결제 로그** | ✅ 구현 | `PaymentLogs`, `RevenueView` - `revenue_transactions` 기반 |
| **transaction_date** | ✅ DB 기본값 | `revenue_transactions.transaction_date`에 `CURRENT_TIMESTAMP` 기본값 적용됨 |
| **기간제/쿠폰/워크샵 구분** | ⚠️ 부분적 | `ticket_type`(COUNT/PERIOD)으로 구분. `ticket_category`(regular/popup/workshop)은 조회하지 않음 |
| **구매 경로 구분** | ⚠️ 미구분 | 관리자 판매 vs 유저 직접 구매 구분 없음 (`payment_method`로 CARD 등만 구분) |

**구현 위치:**  
- `app/academy-admin/.../sales/payment-logs.tsx`  
- `app/academy-admin/.../revenue-view.tsx`

---

## 2. 수강생 등록 및 보유 수강권 표기

### 2-1. 수강생 등록

| 항목 | 구현 상태 | 비고 |
|------|----------|------|
| **수강권 구매 시 자동 등록** | ✅ 구현 | `academy_students`에 user_id, academy_id 저장 |
| **관리자 직접 판매 시** | ✅ 구현 | `sales-form` confirmPayment에서 academy_students 등록 |
| **API 구매 시** | ✅ 구현 | `purchase/route.ts`에서 academy_students 등록 |
| **학원별 학생 목록** | ✅ 구현 | `academy_students` + `users` 기반 `StudentView` |

---

### 2-2. 보유 수강권 표기

#### 유저뷰

| 화면 | 구현 상태 | 비고 |
|------|----------|------|
| **마이페이지 요약** | ✅ 구현 | 기간제/쿠폰/워크샵 개수만 표시 (`/api/user-tickets` → `ticketSummary`) |
| **수강권 상세 목록** | ⚠️ 표기 버그 | `TicketsView`: 기간제에서 `remaining_count`가 null인데 "0회"로 표시 |
| **학원별 그룹화** | ✅ 구현 | `TicketsView`에서 학원별 수강권 그룹 표시 |
| **만료/사용완료 필터** | ❌ 논리 오류 | `filteredTickets`가 `ticket.status === 'EXPIRED'` 기준인데, DB에는 ACTIVE/USED만 존재. "만료"는 `expiry_date < today`로 계산해야 함 |
| **기간제 잔여 표기** | ❌ 부적절 | "잔여 횟수: 0회" 대신 "무제한" 등으로 표기 필요 |

#### 관리자 관점

| 화면 | 구현 상태 | 비고 |
|------|----------|------|
| **학생 목록·요약** | ✅ 구현 | `StudentView`: 검색, 필터(수강중/만료예정/휴면), 총 잔여 횟수, 최근 만료일 |
| **getTotalRemaining** | ⚠️ 기간권 미반영 | 기간제(remaining_count=null)는 0으로 계산 → "총 잔여"에 기간권 1장 = 0으로 표시 |
| **학생 상세 모달** | ✅ 구현 | `StudentDetailModal`: 보유 수강권 목록, 기간제=무제한, 횟수권=잔여N회, 만료일, 상태 |
| **수강권 유형 라벨** | ✅ 구현 | 기간제/쿠폰제(횟수제)/워크샵(특강) 구분 표시 |

**구현 위치:**  
- 유저: `components/views/tickets-view.tsx`, `my-page-view.tsx`  
- 관리자: `app/academy-admin/.../student-view.tsx`, `students/student-detail-modal.tsx`

---

## 3. 사용 시 차감 및 기간 계산

### 3-1. 차감 로직

| 수강권 유형 | 차감 방식 | 구현 상태 | 비고 |
|-------------|----------|----------|------|
| **기간제** | 차감 없음, 기간만 검사 | ✅ | `consumeUserTicket`: `ticket_type === 'PERIOD'` 또는 `remaining_count === null`이면 차감 없음 |
| **쿠폰제** | `remaining_count` 1회 차감 | ✅ | 0이 되면 `status = 'USED'` |
| **워크샵** | `remaining_count` 1회 차감 | ✅ | 동일 로직 |
| **예약 실패 시 롤백** | 횟수권만 롤백 | ✅ | 기간권은 차감하지 않았으므로 롤백 제외 |

**구현 위치:** `lib/db/user-tickets.ts` → `consumeUserTicket`

---

### 3-2. 기간 계산

| 항목 | 구현 상태 | 비고 |
|------|----------|------|
| **기간제** | ✅ | `start_date` ~ `expiry_date`, `valid_days` 기반 계산 |
| **쿠폰제** | ✅ | `count_options` 옵션별 `valid_days` 적용, null=무기한 |
| **워크샵** | ✅ | `valid_days` 기반 |
| **만료 필터** | ✅ | `getAvailableUserTickets`에서 `expiry_date >= today` 또는 null만 반환 |
| **기간권 만료 상태** | ⚠️ | `user_tickets.status`는 ACTIVE/USED만 사용. "만료"는 DB에 저장하지 않고 클라이언트에서 `expiry_date`로 계산 |

---

## 4. 일시정지 및 연장 신청

### 4-1. 유저뷰

| 항목 | 구현 상태 | 비고 |
|------|----------|------|
| **연장/일시정지 신청 버튼** | ✅ 구현 | `TicketsView`: ACTIVE 수강권에 "연장/일시정지 신청" 버튼 |
| **연장 신청 폼** | ✅ 구현 | `TicketExtensionRequestModal`: EXTENSION(연장 일수), PAUSE(시작일~종료일), 사유 입력 |
| **학원별 최대 일수** | ✅ 구현 | `academies.max_extension_days` 사용 |
| **기간제만 표시** | ⚠️ | `expiry_date`가 있는 수강권에만 버튼 노출. 횟수권(쿠폰/워크샵)도 `expiry_date` 있으면 연장 가능(의도에 부합) |
| **신청 후 알림** | ❌ 미구현 | 승인/거절 시 유저 알림 없음 |

**구현 위치:** `components/modals/ticket-extension-request-modal.tsx`, `components/views/tickets-view.tsx`

---

### 4-2. 관리자 관점

| 항목 | 구현 상태 | 비고 |
|------|----------|------|
| **연장/일시정지 관리 탭** | ✅ 구현 | `ExtensionRequestsView` - 신청 목록, 승인/거절 |
| **관리자 직접 생성** | ✅ 구현 | `AdminExtensionCreateModal` - 즉시 승인 형태로 연장/일시정지 등록 |
| **거절 사유** | ✅ 구현 | 거절 시 `reject_reason` 필수 입력 |
| **기간제 PAUSE 시 예약 처리** | ✅ 구현 | absent 기간 예약 취소 후, 연장된 기간에 예약 재생성 |
| **학원 정책 설정** | ✅ 구현 | `ExtensionPolicySettingsCard` - `max_extension_days` 설정 |
| **쿠폰/워크샵 연장** | ✅ 지원 | API가 `ticket_type` 제한 없이 `expiry_date` 연장 처리 |

**구현 위치:**  
- `app/academy-admin/.../extension-requests-view.tsx`  
- `app/academy-admin/.../modals/admin-extension-create-modal.tsx`  
- `app/api/ticket-extension-requests/`

---

## 5. 목록 (Lists)

### 5-1. 유저 목록

| 목록 | 구현 상태 | 비고 |
|------|----------|------|
| **보유 수강권** | ⚠️ | `TicketsView` - EXPIRED 필터 동작 안 함, 기간제 잔여 "0회" 표시 |
| **예약 목록** | ✅ | `/api/bookings` |
| **구매 가능 수강권** | ✅ | 세션 예약 시 `count_options` 확장, 옵션별 선택 |

---

### 5-2. 관리자 목록

| 목록 | 구현 상태 | 비고 |
|------|----------|------|
| **수강생** | ✅ | 검색, 상태 필터, 학원별 |
| **수강권(상품)** | ✅ | 기간제/쿠폰/워크샵 구분, `ProductView`, `TicketModal` |
| **매출/결제** | ✅ | `PaymentLogs`, `RevenueView` |
| **연장/일시정지 신청** | ✅ | `ExtensionRequestsView` |

---

## 6. 매출 표기

### 6-1. 관리자

| 항목 | 구현 상태 | 비고 |
|------|----------|------|
| **이번 달 매출** | ✅ | `RevenueView` - `transaction_date` 기준 월별 합산 |
| **결제 내역 테이블** | ✅ | 날짜, 회원, 상품명, 금액, 할인, 결제 방법 |
| **transaction_date** | ✅ | INSERT 시 미지정 시 DB 기본값 사용. `revenue.ts`는 `transaction_date`로 기간 필터 |
| **기간제/쿠폰/워크샵 구분** | ⚠️ | `ticket_type`만 사용. `ticket_category` 미표시 |
| **수강권 유형별 매출** | ❌ | 기간제/쿠폰/워크샵별 집계 없음 |

---

### 6-2. 유저

| 항목 | 구현 상태 | 비고 |
|------|----------|------|
| **유저 전용 구매 이력** | ❌ | `revenue_transactions`를 유저 기준으로 조회하는 API·화면 없음 |
| **결제내역 화면** | ❌ | `PaymentHistoryView`가 항상 빈 배열 |

---

## 7. 정리: 수정 권장 사항

### 높은 우선순위

1. **유저 구매/결제 이력**  
   - `PaymentHistoryView`: `revenue_transactions` + `bookings` 기반으로 유저 자신의 구매·수강권 사용 이력 표시
   - 유저 전용 API 또는 기존 API 확장 필요

2. **TicketsView "만료" 필터**  
   - `ticket.status === 'EXPIRED'` 대신  
     `(ticket.expiry_date && new Date(ticket.expiry_date) < new Date())`로 만료 판단

3. **TicketsView 기간제 잔여 표기**  
   - `remaining_count == null`이면 "무제한" 또는 "기간 내 무제한" 등으로 표시

### 중간 우선순위

4. **StudentView getTotalRemaining**  
   - 기간제(remaining_count=null)는 1장당 1로 카운트하거나, 별도 "기간권 N장" 형태로 표기

5. **결제 로그 수강권 유형**  
   - `ticket_category` 또는 `access_group`으로 기간제/쿠폰/워크샵 구분 표시

### 낮은 우선순위

6. **연장/일시정지 승인·거절 알림**  
   - 유저에게 이메일/앱 알림 전송

7. **수강권 유형별 매출 집계**  
   - 대시보드에 기간제/쿠폰/워크샵별 매출 추가

---

## 8. 구현 상태 요약 매트릭스

| 기능 | 기간제 | 쿠폰제 | 워크샵 | 유저뷰 | 관리자 |
|------|--------|--------|--------|--------|--------|
| 구매 이력 조회 | - | - | - | ❌ | ✅ |
| 수강생 등록 | ✅ | ✅ | ✅ | - | ✅ |
| 보유 수강권 표기 | ⚠️ | ✅ | ✅ | ⚠️ | ✅ |
| 사용 시 차감 | 무차감 | ✅ | ✅ | - | - |
| 기간 계산 | ✅ | ✅ | ✅ | - | - |
| 연장/일시정지 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 목록 | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| 매출 표기 | - | - | - | ❌ | ✅ |

---

*분석 기준: 2025년 2월 코드베이스*
