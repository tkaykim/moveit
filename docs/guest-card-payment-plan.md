# 비로그인 카드 결제 및 학원 관리자 확인 계획

**최종 결정 (반영됨)**  
비로그인 카드 결제(단건 결제)는 진행하지 않음. **수강권 선택·카드 결제는 로그인 후에만 가능**하며, 비로그인 시에는 **회원가입·로그인을 유도**한 뒤 로그인 후 수강권 선택·결제가 가능하도록 예약 페이지 UI를 구성함. 현장 결제는 보조 옵션으로 유지.

---

## 1. 목표 (초안 — 참고용)

- **비로그인 사용자**: 수업 선택 후 "현장결제"만 가능한 상태에서, **이름·연락처 입력 후 즉시 카드 결제**를 선택할 수 있도록 한다.
- **학원(academy-admin)**: 비회원이 카드 결제로 예약한 경우에도 **신청 내역**과 **결제 완료 여부**를 확인할 수 있어야 한다.
- **회원 가입 유도**: 예약 완료 후 유저 페이지/성공 페이지에서 QR 출석·수강권 관리를 위해 **회원가입을 권장**한다.

---

## 2. 현재 구조 요약

| 구분 | 현재 동작 |
|------|-----------|
| 비로그인 예약 | 결제 방법 기본값 `onsite` → 현장결제 경고 모달 후 이름·연락처 입력 → `POST /api/bookings/guest` → 예약 생성 (user_id=null, guest_name/guest_phone, payment_status=PENDING) |
| 로그인 예약 | 수강권 사용 / 수강권 구매 후 예약(카드·계좌) / (현장결제 없음) |
| 결제 주문 | `POST /api/tickets/payment-order` (로그인 필수) → `user_ticket_payment_orders` 에 user_id, ticket_id, schedule_id, amount 저장 |
| 결제 확인 | `POST /api/tickets/payment-confirm` (로그인 필수) → Toss 확인 → user_tickets + bookings 생성 |
| academy-admin | bookings 조회 시 `*` 로 가져오므로 `payment_status` 포함. 단, 테이블에 **결제 상태 표시 컬럼은 미노출** |

---

## 3. 구현 계획

### 3.1 DB·주문 저장소

- **옵션 A (권장)**: **게스트 세션 결제 전용 주문 테이블** 추가  
  - 예: `guest_session_payment_orders`  
  - 컬럼: `id`, `order_id`(유니크), `schedule_id`, `guest_name`, `guest_phone`, `amount`, `order_name`, `status`(PENDING/COMPLETED/FAILED), `toss_payment_key`, `created_at`, `updated_at`  
  - 로그인 불필요한 주문이므로 `user_id` 없음.
- **옵션 B**: 기존 `user_ticket_payment_orders` 에 타입 확장 (예: `type = 'GUEST_SESSION'`, `user_id` nullable, `guest_name`/`guest_phone` 컬럼 추가).  
  - 기존 결제 확인 API와 분리 유지가 필요하고, 스키마 변경이 테이블 공용이므로 옵션 A가 단순할 수 있음.

**선택**: 옵션 A로 신규 테이블 `guest_session_payment_orders` 생성.

### 3.2 API

| API | 메서드 | 인증 | 역할 |
|-----|--------|------|------|
| **주문 생성** | `POST /api/bookings/guest-card-order` | 불필요 | body: `scheduleId`, `guestName`, `guestPhone`. 세션 유효성·정원·중복(동일 연락처) 검사 후 금액(classes.price) 기준 주문 생성. 반환: `{ orderId, amount, orderName }`. |
| **결제 확인** | `POST /api/bookings/guest-card-confirm` | 불필요 | body: `paymentKey`, `orderId`, `amount`. Toss 결제 확인 → 주문 조회(order_id만, user_id 없음) → booking 생성: `schedule_id`, `class_id`, `user_id=null`, `guest_name`, `guest_phone`, `status=CONFIRMED`, `payment_status=COMPLETED`. schedule.current_students +1. 주문 status=COMPLETED. |

- **중복 예약**: 기존과 동일하게 `schedule_id` + `guest_phone` (및 status != CANCELLED) 으로 1건만 허용.
- **금액**: 해당 스케줄의 `classes.price` 사용 (0이면 별도 정책 결정 필요).

### 3.3 프론트 (예약 페이지 `app/(main)/book/session/[sessionId]/page.tsx`)

- **비로그인일 때 결제 방법**  
  - 기존: "현장 결제"만 노출되고 기본 선택.  
  - 변경:  
    1. **카드 결제 (이름·연락처 입력)**  
    2. **현장 결제 (이름·연락처 입력)**  
  - 기본 선택: **카드 결제**로 변경해도 됨(제품 정책에 따라 결정). 또는 현장결제 기본 유지하고 카드 결제 옵션만 추가.
- **카드 결제 선택 시**  
  - 이름·연락처 입력 필드 (기존 현장결제와 동일한 guestName, guestPhone 상태 활용).  
  - "결제하기" 클릭 시:  
    - 유효성 검사(이름·연락처 필수).  
    - `POST /api/bookings/guest-card-order` → `orderId`, `amount`, `orderName` 수신.  
    - Toss 결제창 호출 (successUrl: `/payment/guest-session/success?sessionId=...&orderId=...&...`, failUrl: `/payment/guest-session/fail?sessionId=...`).  
- **결제 성공 페이지**  
  - 신규: `app/(main)/payment/guest-session/success/page.tsx`  
    - `paymentKey`, `orderId`, `amount` 등 쿼리로 수신 후 `POST /api/bookings/guest-card-confirm` 호출.  
    - 성공 시 `/book/session/[sessionId]/success?type=guest_card&name=...` 로 리다이렉트.  
  - 실패 페이지: `app/(main)/payment/guest-session/fail/page.tsx` → 세션 예약 페이지로 돌아가기 등.
- **기존 현장 결제**  
  - 유지. "현장 결제" 선택 시 기존처럼 경고 모달 → 이름·연락처 → `POST /api/bookings/guest` (payment_status=PENDING).

### 3.4 academy-admin (신청 내역·결제 사실 확인)

- **bookings**  
  - 이미 `payment_status` 컬럼 존재.  
  - 게스트 카드 결제 시: `guest_name`, `guest_phone`, `user_id=null`, `payment_status=COMPLETED`.  
- **enrollments-view (신청 목록)**  
  - bookings `*` select 에 이미 `payment_status` 포함.  
  - 테이블에 **결제 상태** 컬럼 추가:  
    - 예: "결제" 컬럼에 `payment_status === 'COMPLETED'` → "결제완료", 그 외(현장 등) → "현장결제" 또는 "미결제" 등 표시.  
  - 비회원(guest_name/guest_phone 있고 user 없음) 행에 "비회원" 뱃지 유지 + 결제완료/현장결제 구분 표시.

### 3.5 회원 가입 유도 (QR 출석·수강권 관리)

- **예약 성공 페이지** (`/book/session/[sessionId]/success`)  
  - `type=guest` 또는 `type=guest_card` 일 때:  
    - 안내 문구 추가: "QR 출석 체크와 수강권 관리를 위해 **회원가입**을 권장합니다."  
    - 버튼: "회원가입하기" → `/login` 또는 회원가입 플로우로 이동.  
- **(선택)** 유저 페이지(마이페이지) 비로그인 상태에서 "예약 내역 보기" 등 진입 시에도 회원가입 유도 노출.

---

## 4. 파일·작업 목록 (체크리스트)

### DB
- [ ] Supabase에 `guest_session_payment_orders` 테이블 생성 (마이그레이션 또는 SQL)
- [ ] (선택) `types/database.ts` 에 타입 반영

### API
- [ ] `POST /api/bookings/guest-card-order` — 비로그인 주문 생성
- [ ] `POST /api/bookings/guest-card-confirm` — Toss 확인 후 booking 생성

### 프론트 (예약 플로우)
- [ ] `app/(main)/book/session/[sessionId]/page.tsx`  
  - 비로그인 시 결제 방법에 "카드 결제 (이름·연락처)" 추가  
  - 카드 결제 선택 시 이름·연락처 입력 후 guest-card-order → Toss 결제창
- [ ] `app/(main)/payment/guest-session/success/page.tsx` — 결제 성공 시 guest-card-confirm 호출 후 세션 성공 페이지로 리다이렉트
- [ ] `app/(main)/payment/guest-session/fail/page.tsx` — 결제 실패 시 안내 및 세션 예약 페이지 링크

### 성공 페이지·회원 가입 유도
- [ ] `app/(main)/book/session/[sessionId]/success/page.tsx` — type=guest / guest_card 일 때 회원가입 유도 문구·버튼 추가

### academy-admin
- [ ] `app/academy-admin/.../enrollments-view.tsx` — 신청 목록 테이블에 결제 상태 컬럼(payment_status) 표시

### 번역·문구
- [ ] `locales/ko.json`, `locales/en.json` — 비로그인 카드 결제 관련 라벨/메시지 추가

---

## 5. 보안·검증 요약

- **guest-card-order**: schedule_id 유효성, 정원, 과거 일정, 동일 guest_phone 중복 예약 방지.
- **guest-card-confirm**: order_id로 주문 조회 후 amount 일치 검사, Toss 승인 후 1회만 booking 생성(멱등 처리 권장).
- **개인정보**: guest_name, guest_phone은 예약·결제 및 학원 관리용으로만 사용. 회원가입 유도 시 동일 연락처 연동은 별도 기획(선택).

---

## 6. 요약

- 비로그인 사용자는 **이름·연락처 + 카드 결제**로 한 건 예약 가능.
- 주문은 `guest_session_payment_orders`, 예약은 기존 `bookings` (guest_name, guest_phone, payment_status=COMPLETED).
- academy-admin에서는 **비회원** + **결제완료/현장결제** 구분 표시로 신청·결제 사실 확인 가능.
- 예약 성공 페이지에서 **QR 출석·수강권 관리를 위한 회원가입** 유도.

이 계획대로 구현하면 요구사항을 충족할 수 있습니다.
