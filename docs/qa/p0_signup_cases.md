# P0-2 회원가입 Case A/B/C 재현 QA 시나리오

본 문서는 `signup_with_guest_merge` v2 마이그레이션 적용 후 세 가지 케이스가
모두 정상 처리되는지 수동 검증하는 절차입니다. Supabase SQL Editor 또는
psql에서 준비 SQL을 실행한 뒤, 클라이언트(Next.js 앱)에서 가입을 시도하고
결과 SQL로 상태를 확인합니다.

**⚠️ 준비 SQL은 반드시 staging/dev 환경에서만 실행하세요. 프로덕션 DB에 직접 시드하지 마세요.**

---

## 사전 준비

- Staging Supabase 프로젝트에 마이그레이션 적용 확인
  ```sql
  SELECT pg_get_functiondef('public.signup_with_guest_merge'::regproc);
  -- 반환 결과에 "ON CONFLICT (id) DO UPDATE" 문자열이 포함돼야 함
  ```
- 테스트 이메일은 A/B/C별로 분리:
  - Case A: `qa-a+<timestamp>@example.com`
  - Case B: `qa-b+<timestamp>@example.com`
  - Case C: `qa-c+<timestamp>@example.com`

---

## Case A — 비회원 row만 존재, auth.users에는 없음 (정상 경로)

**재현 의미:** 비회원으로 결제만 한 사용자가 처음 회원가입할 때. 기존 경로도 잘 동작해야 함.

### Step 1 — 시드
```sql
-- 비회원 row만 생성 (auth.users는 건드리지 않음)
INSERT INTO public.users (id, email, name, phone, is_guest, role)
VALUES (
  gen_random_uuid(),
  lower('qa-a@example.com'),
  'QA A',
  '01011110000',
  true,
  'USER'
);

-- 이 id에 연결된 가상 booking/ticket을 1건 붙여두면 이관 확인에 좋음
-- (선택) INSERT INTO public.bookings (...) VALUES (...);
```

### Step 2 — 클라이언트
앱에서 `qa-a@example.com` + 아무 비밀번호 + 이름 입력 → 회원가입.

### Step 3 — 검증
```sql
-- users 테이블: is_guest=false, role=USER, id는 auth.users.id와 동일
SELECT id, email, is_guest, role
FROM public.users
WHERE lower(email) = 'qa-a@example.com';

-- auth.users에 새로 생겼는지
SELECT id, email FROM auth.users WHERE lower(email) = 'qa-a@example.com';

-- 두 id가 같은지 확인 (guest row가 auth.users id로 병합돼야 함)
```

**기대 결과:**
- `public.users.is_guest = false`
- `public.users.id = auth.users.id`
- 기존 guest row는 병합돼 1건만 남음

---

## Case B — 정상 회원이 이미 존재 (로그인 유도 경로)

**재현 의미:** 이미 가입한 회원이 실수로 재가입 시도. 안내 메시지 후 로그인 탭으로 전환돼야 함.

### Step 1 — 시드
앱에서 정상적으로 `qa-b@example.com`으로 한 번 가입 완료. 가입 후 로그아웃.

### Step 2 — 클라이언트
같은 이메일 `qa-b@example.com`으로 회원가입 재시도.

### Step 3 — 검증
- **UI:** "이미 가입된 이메일입니다. 로그인해주세요." 에러 표시 + 자동으로 **로그인 탭**으로 전환되고 비밀번호 입력란이 초기화됨
- **DB:** 변화 없음 (회원 1명, `is_guest=false` 유지)

```sql
SELECT count(*) FROM public.users WHERE lower(email) = 'qa-b@example.com';
-- 1이어야 함

SELECT is_guest FROM public.users WHERE lower(email) = 'qa-b@example.com';
-- false여야 함
```

**기대 결과:**
- 중복 row 미생성
- 기존 정상 회원 데이터 변경 없음
- 프리체크 API (`/api/auth/precheck-email`)는 `{isGuest: false}` 반환

---

## Case C — auth.users에 남아 있고 public.users에는 같은 id의 is_guest=true row (PK 충돌 복구)

**재현 의미:** v2 마이그레이션의 핵심 목표. 이 상태가 발생하면 기존 RPC는 PK 충돌로 무한 실패했음.

### Step 1 — 시드
가장 안전한 재현 방법: **정상 가입 후 public.users만 조작**.

```sql
-- 1. 앱에서 qa-c@example.com으로 가입 (Case B Step 1처럼)
-- 2. 가입 완료 후, public.users의 해당 row를 is_guest=true로 되돌림 (Case C 시뮬레이션)
UPDATE public.users
SET is_guest = true, role = 'USER'
WHERE lower(email) = 'qa-c@example.com';

-- 3. auth.users에는 여전히 같은 id로 계정이 살아 있는 상태
SELECT u.id AS public_id, au.id AS auth_id, u.is_guest
FROM public.users u
JOIN auth.users au ON au.id = u.id
WHERE lower(u.email) = 'qa-c@example.com';
-- public_id = auth_id, is_guest=true 확인
```

### Step 2 — 클라이언트
로그아웃 상태에서 `qa-c@example.com` + **새 비밀번호**로 회원가입 재시도.

현재 구현:
- `supabase.auth.signUp`은 "User already registered" 에러를 반환 (auth.users에 이미 존재)
- 클라이언트는 precheck-email로 `{isGuest: true}` 확인
- "이미 가입 절차가 시작된 이메일입니다. 로그인해주세요." 메시지 + 로그인 탭 자동 전환

**→ 사용자는 비밀번호 재설정(기존 비밀번호 기억 안 나면)으로 로그인 가능.** 로그인 성공 시 `link-guest-bookings`가 돌거나, 또는 다음 가입 재시도 시 RPC v2의 ON CONFLICT 복구가 자동으로 `is_guest=false`로 업데이트.

### Step 3 — ON CONFLICT 복구 직접 검증 (RPC 단독)
```sql
-- auth.users에 존재하는 id를 사용해 RPC를 직접 호출
SELECT id FROM auth.users WHERE lower(email) = 'qa-c@example.com';
-- 위 id를 아래 p_auth_id에 대입

SELECT public.signup_with_guest_merge(
  p_auth_id := '<위 id>'::uuid,
  p_email := 'qa-c@example.com',
  p_name := 'QA C',
  p_phone := NULL
);

-- 검증
SELECT id, is_guest, role, name
FROM public.users
WHERE lower(email) = 'qa-c@example.com';
-- is_guest=false, role=USER, name='QA C' 로 업데이트돼야 함
```

**기대 결과:**
- RPC 예외 발생 없음 (PK 충돌 해결됨)
- `public.users.is_guest`가 `true` → `false`로 업데이트
- `public.users` row는 1건 유지, id는 그대로

---

## 추가 검증 — 이메일 대소문자 매칭

**재현 의미:** 결제 시 `TEST@x.com`, 가입 시 `test@x.com` 입력해도 병합되는지.

```sql
-- 대문자 이메일로 guest row 삽입
INSERT INTO public.users (id, email, name, is_guest, role)
VALUES (gen_random_uuid(), 'QA-CASE@Example.COM', 'Mixed Case', true, 'USER');
```

앱에서 `qa-case@example.com` (소문자)로 가입 → 위 row가 병합돼야 함.

```sql
SELECT count(*), bool_and(is_guest = false)
FROM public.users
WHERE lower(email) = 'qa-case@example.com';
-- count=1, is_guest=false
```

---

## 회귀 항목 (P0 외 영향 없음 확인)

- [ ] 기존 로그인/로그아웃 정상
- [ ] `/api/me/link-guest-bookings` 비회원 예약 병합 정상
- [ ] 1회성 티켓 카드결제 비회원 플로우 정상
- [ ] 1회성 티켓 계좌이체 비회원 플로우 정상
- [ ] 정기권 회원 결제 정상

---

## 정리 (dev 환경 테스트 후 테스트 데이터 삭제)

```sql
DELETE FROM public.users WHERE lower(email) LIKE 'qa-%@example.com';
-- auth.users는 Supabase Dashboard > Authentication > Users에서 수동 삭제
```
