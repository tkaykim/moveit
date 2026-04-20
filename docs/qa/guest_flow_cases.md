# B-2 비회원 수강신청·병합·출석 전수 QA 시나리오

본 문서는 B-2 (2026-04-21) 이터레이션의 수동 검증 절차입니다. 다음 변경이 적용된 환경에서 실행하세요:

- `bank-transfer-order`가 비회원 결제 시 `guest user`를 즉시 생성
- `bank-transfer-confirm`이 비회원 주문도 회원 경로로 `user_ticket` / `revenue_transaction` 즉시 발급
- `link-guest-bookings`가 `GUEST_MERGED` activity log를 기록
- `bookings.status`에 `ABSENT` 상태 추가
- `email` / `phone` 정규화는 모든 진입점에서 공통 유틸 사용

**⚠️ 준비 SQL은 staging/dev에서만.**

---

## 시나리오 S1 — 카드결제 비회원 → 회원가입 → 자동 연결

**재현 의미:** 가장 기본 경로. 정상 작동 보장.

### Step 1 — 결제
1. 로그아웃 상태에서 특정 수업(schedule)의 1회성 티켓을 선택
2. `이름=QA S1`, `전화=010-1111-1111`, `이메일=QA-S1@Example.com`로 카드결제 완료

### Step 2 — 가입 전 상태 검증
```sql
-- guest user 생성됨
SELECT id, name, phone, email, is_guest FROM public.users
WHERE lower(email) = 'qa-s1@example.com';
-- is_guest=true, phone='01011111111', email='qa-s1@example.com'

-- booking에 user_id 채워짐 + guest_name도 동반 저장
SELECT user_id, guest_name, guest_phone, status
FROM public.bookings WHERE guest_name = 'QA S1';
-- user_id = (위 guest id), status='CONFIRMED'

-- user_ticket 발급
SELECT user_id, status, remaining_count FROM public.user_tickets
WHERE user_id = (SELECT id FROM public.users WHERE lower(email)='qa-s1@example.com');
-- status='USED' (1회성 소진), remaining_count=0
```

### Step 3 — 가입
`qa-s1@example.com` + 임의 비밀번호 + 이름으로 가입.

### Step 4 — 병합 후 검증
```sql
-- guest user 사라지고 auth.users와 통합된 user row만 존재
SELECT id, is_guest FROM public.users WHERE lower(email)='qa-s1@example.com';
-- is_guest=false, id = auth.users.id

-- booking, user_ticket 모두 auth user id로 연결
SELECT user_id FROM public.bookings WHERE guest_name = 'QA S1';
-- user_id = auth.users.id (위와 동일)

-- GUEST_MERGED activity log 1건 (해당 academy)
SELECT action, payload FROM public.enrollment_activity_log
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email)='qa-s1@example.com')
  AND action = 'GUEST_MERGED';
```

**기대 결과:**
- `/my/bookings`에서 S1 예약 정상 표시
- `/my/tickets`에서 소진된 티켓 이력 표시
- 관리자 activity log에 `GUEST_MERGED` 이벤트 기록

---

## 시나리오 S2 — 계좌이체 비회원 → 입금확인 → 가입 → 자동 연결

**재현 의미:** B-2의 핵심 변경 경로. 입금확인 즉시 `user_ticket` 발급되는지 검증.

### Step 1 — 계좌이체 신청
1. 로그아웃 상태에서 1회성 티켓 + 특정 수업으로 계좌이체 신청
2. `이름=QA S2`, `전화=010-2222-2222`, `이메일=qa-s2@example.com`

### Step 2 — 신청 직후 상태
```sql
-- guest user 생성됨
SELECT id, is_guest FROM public.users WHERE lower(email)='qa-s2@example.com';

-- bank_transfer_orders에 user_id 채워짐, status=PENDING
SELECT user_id, status FROM public.bank_transfer_orders
WHERE orderer_email = 'qa-s2@example.com';
-- user_id = (guest id), status='PENDING'

-- booking도 PENDING으로 선생성됨
SELECT user_id, status, payment_status FROM public.bookings
WHERE guest_name = 'QA S2';
-- user_id = (guest id), status='PENDING', payment_status='PENDING'
```

### Step 3 — 관리자 입금확인
학원 관리자로 로그인 → 계좌이체 주문 목록 → 입금확인 클릭.

### Step 4 — 입금확인 후 상태
```sql
-- user_ticket 즉시 발급 (과거엔 null이었음)
SELECT status, remaining_count FROM public.user_tickets
WHERE user_id = (SELECT id FROM public.users WHERE lower(email)='qa-s2@example.com');
-- status='USED', remaining_count=0

-- revenue_transaction 즉시 기록 (매출 통계에 반영)
SELECT payment_status, final_price FROM public.revenue_transactions
WHERE user_id = (SELECT id FROM public.users WHERE lower(email)='qa-s2@example.com');
-- payment_status='COMPLETED'

-- booking은 CONFIRMED + user_ticket_id 채워짐
SELECT status, user_ticket_id FROM public.bookings
WHERE guest_name = 'QA S2';
-- status='CONFIRMED', user_ticket_id IS NOT NULL

-- academy_students 등록됨
SELECT 1 FROM public.academy_students
WHERE user_id = (SELECT id FROM public.users WHERE lower(email)='qa-s2@example.com');
```

### Step 5 — 가입
`qa-s2@example.com`으로 가입. 로그인 후:

```sql
-- `/my/bookings`, `/my/tickets`, `/payment-history`에서 모두 정상 표시
-- GUEST_MERGED activity log 기록됨
```

**기대 결과:**
- 매출 통계에 즉시 반영 (과거 버전은 가입 전까지 누락)
- `link-guest-bookings` Phase 4(소급 발급)는 호출되지만 `unissuedOrders`가 0건이므로 no-op

---

## 시나리오 S3 — 계좌이체 비회원 환불 (Revert)

**재현 의미:** 비회원 주문 환불 시 데이터 정합성.

### Step 1 — S2 Step 4까지 진행
(위 S2와 동일하게 입금확인까지 완료)

### Step 2 — 관리자 환불(revert)
관리자 화면에서 해당 주문 revert.

### Step 3 — 검증
```sql
SELECT status, user_ticket_id FROM public.bank_transfer_orders
WHERE orderer_email = 'qa-s2@example.com';
-- status='PENDING', user_ticket_id=null

-- user_ticket은 삭제됨
SELECT * FROM public.user_tickets
WHERE user_id = (SELECT id FROM public.users WHERE lower(email)='qa-s2@example.com');
-- 0 rows

-- booking은 PENDING으로 복귀
SELECT status FROM public.bookings WHERE guest_name='QA S2';
-- PENDING

-- REFUND activity log 기록됨 (이미 구현돼 있음)
SELECT action FROM public.enrollment_activity_log
WHERE booking_id = (SELECT id FROM public.bookings WHERE guest_name='QA S2')
  AND action = 'REFUND';
```

---

## 시나리오 S4 — 결석(ABSENT) 처리

**재현 의미:** 새로 도입된 상태의 UI/DB/activity log 검증.

### Step 1 — CONFIRMED booking 준비
S1 또는 회원 경로로 CONFIRMED 상태의 booking 1건 확보.

### Step 2 — 관리자 UI에서 결석 처리
`/academy-admin/.../enrollments` → 대상 예약의 액션 메뉴 → **"결석 처리"** 클릭.

### Step 3 — 검증
```sql
SELECT status FROM public.bookings WHERE id = '<booking_id>';
-- ABSENT

-- schedule.current_students 계산에서 제외됨 (CONFIRMED+COMPLETED만 카운트)
SELECT current_students FROM public.schedules
WHERE id = (SELECT schedule_id FROM public.bookings WHERE id='<booking_id>');

-- activity log
SELECT action, payload FROM public.enrollment_activity_log
WHERE booking_id = '<booking_id>'
ORDER BY created_at DESC LIMIT 1;
-- action='ABSENT_MARKED', payload에 previous_status='CONFIRMED'
```

### Step 4 — 결석 취소
"결석 취소" 클릭 → status=CONFIRMED, activity log `ABSENT_CLEARED` 기록.

### Step 5 — UI 필터 확인
상단 탭에서 "결석" 필터 선택 시 ABSENT만 표시.

---

## 시나리오 S5 — 대소문자 + 하이픈 정규화 매칭

**재현 의미:** P0-A 수정 검증 (bank-transfer-order 정규화).

### Step 1 — 계좌이체 비회원 결제
- `이메일=QA-S5@Example.COM`
- `전화=010-5555-5555`

### Step 2 — 정규화 확인
```sql
SELECT email, phone FROM public.users WHERE name='QA S5';
-- email='qa-s5@example.com', phone='01055555555' (둘 다 정규화됨)

SELECT orderer_email, orderer_phone FROM public.bank_transfer_orders
WHERE (SELECT id FROM public.users WHERE name='QA S5') = user_id;
-- orderer_email='qa-s5@example.com', orderer_phone='01055555555'

SELECT guest_email, guest_phone FROM public.bookings
WHERE guest_name='QA S5';
-- guest_email='qa-s5@example.com', guest_phone='01055555555'
```

### Step 3 — 가입 (소문자·하이픈 포함으로)
`qa-s5@example.com` + `010-5555-5555` 로 가입.

```sql
-- booking과 user_ticket이 auth user로 이관됨
SELECT count(*) FROM public.bookings
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email)='qa-s5@example.com');
-- > 0
```

---

## 회귀 체크리스트

- [ ] 회원 카드결제 정상 (변경 없음)
- [ ] 회원 계좌이체 정상 (변경 없음)
- [ ] `/my/bookings` 회원 예약 목록 정상
- [ ] QR 체크인 → `ATTENDANCE_CHECKED` log (이미 동작)
- [ ] 관리자 출석/취소 → guest 정보 payload 보존
- [ ] `/api/academies/search`, `home-view` P0-1 필터 정상
- [ ] P0-2 가입 시 `signup_with_guest_merge` ON CONFLICT 복구 정상

---

## 정리

```sql
DELETE FROM public.bookings
  WHERE guest_name LIKE 'QA S%';
DELETE FROM public.user_tickets
  WHERE user_id IN (SELECT id FROM public.users WHERE name LIKE 'QA S%');
DELETE FROM public.revenue_transactions
  WHERE user_id IN (SELECT id FROM public.users WHERE name LIKE 'QA S%');
DELETE FROM public.bank_transfer_orders
  WHERE user_id IN (SELECT id FROM public.users WHERE name LIKE 'QA S%');
DELETE FROM public.academy_students
  WHERE user_id IN (SELECT id FROM public.users WHERE name LIKE 'QA S%');
DELETE FROM public.enrollment_activity_log
  WHERE user_id IN (SELECT id FROM public.users WHERE name LIKE 'QA S%');
DELETE FROM public.users WHERE name LIKE 'QA S%';
-- auth.users는 Supabase Dashboard에서 수동 삭제
```
