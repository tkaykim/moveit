# 업데이트 계획 (docs/update .md 기반)

> 출처: `docs/update .md`  
> 목적: 수강권 표기·회원·연장/일시정지·신청인원·결제·상담 등 전반 개선

---

## 실제 DB 구조와의 대조 (Supabase MCP 검증)

**검증 방법:** **Supabase MCP**로 실제 프로젝트 DB의 `public` 스키마를 조회하여 계획과 대조함. (`list_tables` + `execute_sql` on `information_schema.columns`)

### Supabase MCP로 확인한 실제 컬럼 (계획 관련 테이블)

| 테이블 | 실제 컬럼 (MCP 기준) | 일치 여부 |
|--------|----------------------|-----------|
| **bookings** | id, user_id, user_ticket_id, hall_id, status, created_at, class_id, schedule_id, **guest_name**, **guest_phone**, payment_status, **is_admin_added** | ✅ 계획과 일치. **admin_note(사유) 없음** → 마이그레이션 필요 |
| **tickets** | id, academy_id, name, price, **ticket_type**, total_count, **valid_days**, class_id, is_on_sale, created_at, is_general, access_group, **is_coupon**, **ticket_category** (check: regular \| popup \| workshop), **count_options** (jsonb), is_public | ✅ 계획과 일치. UI 워딩만 변경 |
| **user_tickets** | id, user_id, ticket_id, **remaining_count**, **start_date**, **expiry_date**, status, created_at | ✅ 계획과 일치 |
| **ticket_classes** | id, ticket_id, class_id, created_at | ✅ 계획과 일치 |
| **consultations** | id, academy_id, user_id, name, phone, **topic**, status, **scheduled_at**, assigned_to, **notes**, created_at, updated_at | ⚠️ **category, detail, visit_datetime 없음** — 확장 또는 신규 테이블 필요 |
| **academies** | id, name_kr, name_en, address, contact_number, logo_url, created_at, tags, instagram_handle, youtube_url, tiktok_handle, website_url, other_url, images, is_active, location, description | ⚠️ **max_extension_days 없음** — 컬럼 추가 필요 |
| **academy_students** | id, academy_id, user_id, created_at, referral_source, interested_genres, level | ✅ 계획과 일치 |

**MCP로 확인한 결과:** `ticket_extension_requests`, `consultation_categories` 테이블은 **public 스키마에 없음**. 연장/일시정지·상담 카테고리 기능 구현 시 신규 생성 필요.

### 현재 DB 테이블·컬럼 요약 (계획 관련)

| 테이블 | 계획에서 사용하는 컬럼/구조 | 일치 여부 | 비고 |
|--------|-----------------------------|-----------|------|
| **tickets** | `ticket_category`: 'regular' \| 'popup' \| 'workshop', `ticket_type`, `valid_days`, `total_count`, `count_options`(jsonb), `is_coupon` | ✅ 일치 | UI 워딩만 변경(정규→기간제, 팝업→쿠폰제). DB 필드명 그대로 사용 |
| **ticket_classes** | `ticket_id`, `class_id` — 수강권별 수강 가능 클래스 | ✅ 일치 | "해당 수강권으로 들을 수 있는 수업" 연결용으로 이미 존재 |
| **user_tickets** | `start_date`, `expiry_date`, `remaining_count`, `status`, `ticket_id`, `user_id` | ✅ 일치 | 연장 시 `expiry_date` 갱신. 일시정지/신청 이력은 **별도 테이블 필요** |
| **bookings** | `user_id`, `guest_name`, `guest_phone`, `user_ticket_id`, `status`, `payment_status`, **`is_admin_added`** | ✅ 일치 | 4-C: 비회원 = guest 필드만 있는 예약, 게스트 = **is_admin_added = true** 로 구분 가능. **수기 추가 사유 저장 컬럼 없음** → 아래 보완 |
| **consultations** | `academy_id`, `name`, `phone`, `topic`, `scheduled_at`, `status`, `notes`, `assigned_to`, `user_id` | ⚠️ 보완 필요 | **없음:** `category`(FK 또는 텍스트), `detail`(상세 내용), `visit_datetime`(방문 예정 일시). 카테고리·소요시간·가능 시각은 **신규 테이블/컬럼** 필요 |
| **academies** | 학원 기본 정보만 | ⚠️ 보완 필요 | 연장 최대 일수(`max_extension_days` 등) **없음** — 컬럼 추가 또는 academy_settings 테이블 필요 |
| **academy_students** | `academy_id`, `user_id`, `created_at`, `level`, `interested_genres`, `referral_source` | ✅ 일치 | 회원 목록·검색은 users + academy_students 조인으로 가능 |

### DB에 없어서 추가가 필요한 항목

| 구분 | 필요한 것 | 비고 |
|------|-----------|------|
| **3. 연장/일시정지** | `ticket_extension_requests` 테이블 (또는 유사명) | user_ticket_id, 요청 유형(연장/일시정지), absent_start/end, 상태(대기/승인/거절), 거절 사유, 처리일 등 |
| **3. 연장 정책** | `academies`에 `max_extension_days` (integer, nullable) 또는 별도 설정 테이블 | 학원별 연장 가능 최대 일수 |
| **4-B. 수기 추가 사유** | `bookings`에 `admin_note` (text, nullable) 또는 `guest_reason` | 관리자 수기 추가 시 사유 저장용 |
| **10. 상담** | `consultations`: `category`(또는 category_id), `detail`, `visit_datetime` / 별도 `consultation_categories` 테이블 (name, duration_minutes) | 카테고리 프리셋·소요시간 |
| **10. 상담 가능 시각** | `academy_consultation_slots` 또는 academies에 Json 컬럼 | 전화/방문 상담 가능 시간대 |

### 계획서 수정 보완 사항 (DB 기준 반영)

- **4-C:** "게스트" 표기는 **bookings.is_admin_added === true** 인 경우로 하면 됨. "비회원"은 `user_id` null 이고 `guest_name`/`guest_phone` 있는 경우(일반 비로그인 신청). **추가 컬럼 불필요** for 표기 구분.
- **4-B:** 수기 추가 시 "사유"를 저장하려면 **bookings에 `admin_note`(또는 `guest_reason`) 컬럼 추가** 필요. 계획에 "admin_note 등"이라고 했으나 현재 DB에는 없으므로 마이그레이션 필요 명시.
- **10-B:** `consultations`에는 `topic`(텍스트), `scheduled_at` 있음. "상세 내용"은 `notes` 활용 가능. **방문 예정 일시**는 `scheduled_at`으로 둘지, 별도 `visit_datetime` 추가할지 결정 필요. **카테고리**는 현재 없음 → consultation_categories 또는 consultations.category 추가.

---

## 개요

| 구분 | 내용 |
|------|------|
| 문서 기준 | docs/update .md 10개 대항목 |
| 영향 범위 | 학원 관리자(academy-admin), 마이페이지(/my), 예약/결제(book), 수강권·회원·상담 |
| 우선순위 | 워딩/표기 → UX 개선 → 신규 기능(연장·일시정지·상담 신청·구매 링크) 순 권장 |

---

## 1. 수강권 표기 (워딩 및 동작)

### 1-A. 기간제 수강권

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| '정규 클래스 수강권' → '기간제 수강권' 표기 | `product-view.tsx` 등에서 "정규 수강권" 사용 | 모든 노출 문구를 "기간제 수강권"으로 변경 |
| 시작일 지정: 구매/획득 시 **또는 수업신청 시 사용된 첫 수업 일자 기준**으로 유효기간 카운팅 | `period-ticket-bookings.ts`, 결제 플로우에 시작일 로직 있음 | (1) 시작일 선택 시 "해당 수강권으로 들을 수 있는 수업이 있는 날"만 선택 가능. (2) **또는** 첫 수업 신청 일자를 유효기간 시작일로 자동 설정하는 옵션 지원 |
| 해당 수강권으로 들을 수 있는 수업 체크 | `ticket_classes`로 연결됨 | 관리자 UI에서 연결된 수업 체크 표시/편집 확인 및 개선 |

**수정 대상 파일(예시):**
- `app/academy-admin/components/views/product-view.tsx` — 정규 → 기간제
- `app/academy-admin/components/views/class-masters-view.tsx` — 정규 수강권 → 기간제 수강권
- `app/academy-admin/config/onboarding-steps.ts` — 정규·팝업·워크샵 문구
- `docs/academy-admin-email-guide.md` — 가이드 문구
- 기간제 시작일 선택: 결제/수강권 발급 UI + `lib/db/period-ticket-bookings.ts` 연동

### 1-B. 쿠폰제(횟수제) 수강권

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| '팝업 수강권' → '쿠폰제(횟수제) 수강권' 표기 | "팝업 수강권" 사용 다수 | "쿠폰제(횟수제) 수강권"으로 일괄 변경 |
| 이름·횟수별 가격·유효기간 설정 | tickets 옵션으로 구현 가능 | UI에서 "취미반 쿠폰-1,3,5회 권" 등 옵션 설정이 명확한지 확인 |
| 해당 수강권으로 들을 수 있는 수업 체크 | `ticket_classes` | 동일하게 연결 UI 확인 |

**수정 대상:**  
- `product-view.tsx`, `class-masters-view.tsx`, `recurring-schedule-modal.tsx`, `onboarding-steps.ts` 등 "팝업" 워딩

### 1-C. 워크샵 수강권

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| '워크샵 수강권' → '워크샵(특강) 수강권' 표기 | "워크샵 수강권" | "워크샵(특강) 수강권"으로 통일 |
| 이름·들을 수 있는 수업 체크·유효기간 | ticket_classes + tickets.valid_days | 유효기간 설정 필드 확인 및 UI 노출 |

---

## 2. 회원 관리

### 2-A. 회원 목록 검색/필터

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 회원 목록 검색·필터 | `student-view.tsx`, `lib/db/academy-admin/students.ts` | 검색(이름/연락처/이메일) 및 필터(학원·상태 등) 기능 확인 후 보강 |

### 2-B. 회원별 수강권 요약 및 상세

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 특정 회원의 수강권 보유 현황(종류·개수·유효기간·잔여 횟수) 간단 표시 | `student-detail-modal.tsx`에 수강권 정보 있음 | 목록/카드에 요약(유효기간, 잔여 횟수) 노출 |
| 클릭 시 상세: 인적사항, 등록일, 보유 수강권 종류·유효기간 등 | 상세 모달 존재 | 상세 보기 레이아웃 정리(인적사항·등록일·수강권 효율적 배치) |

**수정 대상:**  
- `app/academy-admin/components/views/student-view.tsx`  
- `app/academy-admin/components/views/students/student-detail-modal.tsx`

---

## 3. 유효기간 연장 신청 / 일시정지(Pause) 관리

### 3-A. 사용자: 연장/일시정지 신청

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| My페이지(/my)에서 기간제·쿠폰제 수강권에 대해 연장 신청 또는 일시정지 신청 | 미구현 | /my에 "수강권 연장/일시정지 신청" 영역 추가, 신청 API 및 DB 테이블 설계 |

### 3-B. 관리자: 연장/일시정지 승인·거절

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 학원 관리자 페이지에 "수강권 연장/일시정지 관리" 탭 | 미구현 | 새 탭 추가, 신청 목록 조회·승인·거절(거절 시 사유 입력) |
| 승인/거절 시 사용자에게 알림 | 미구현 | 알림(이메일/앱 내) 설계 및 연동 |

### 3-C. 연장 신청 규칙

| 요구사항 | 작업 |
|----------|------|
| 연장 신청 시 "absent 구간(시작일~종료일)" 선택 시 해당 일수만큼 유효기간 연장 | 연장 신청 폼(시작일/종료일) + 승인 시 user_tickets 만료일 연장 로직 |
| 연장 가능 최대 일수는 학원별 정책 → 관리자 설정 | academies 또는 academy_settings에 max_extension_days 등 필드 추가 및 설정 UI |

### 3-D. 관리자 임의 연장/일시정지

| 요구사항 | 작업 |
|----------|------|
| 관리자가 특정 회원에 대해 임의로 유효기간 연장 또는 일시정지 수행 | 회원 상세 또는 수강권 관리 화면에서 "연장/일시정지" 액션 + API |

**신규 필요 (현재 DB에 없음):**  
- DB: `ticket_extension_requests` 테이블 — user_ticket_id, 요청 유형(연장/일시정지), absent_start_date, absent_end_date, 상태(대기/승인/거절), reject_reason, processed_at 등. 학원별 연장 한도: `academies.max_extension_days` (integer, nullable) 추가  
- API: 신청 생성, 목록 조회, 승인/거절, 관리자 임의 연장·일시정지  
- 프론트: /my 신청 폼, academy-admin 연장/일시정지 관리 탭

---

## 4. 신청인원 관리 (출석/신청 관리)

**원문 요구:** 메뉴/탭 워딩을 **"출석/신청 관리"**로 사용 (현재 "신청인원 관리" 등일 수 있음). 해당 화면 제목·메뉴명 통일 확인.

### 4-A. 날짜 선택 → 해당 날짜 수업 예정 인원

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 날짜 선택 시 해당 날짜에 수업 들을 예정인 사람 표시 | `enrollments-view.tsx`에 날짜·스케줄 필터 있음 | 동작 확인: 날짜 선택 시 해당 일자 스케줄만 노출되는지 검증 |
| 수업 선택 시 같은 수업이라도 날짜별 드롭다운 다 나옴 → 날짜 선택 후에는 class 기준으로 수업명 하나만 | `ScheduleSelector`가 schedule 단위 목록 사용 | "날짜 선택 후"에는 해당 날짜의 스케줄을 class 기준으로 그룹핑해 수업명 하나만 보이도록 UI 변경(출석/신청 관리 탭) |

### 4-B. 수기 추가: 이름·연락처·사유 직접 입력

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 수기 추가 시 수강생 검색이 아닌, 이름·연락처·사유 직접 기입 | `AdminAddEnrollmentModal`이 회원 검색 후 선택 방식 | "비회원 수기 추가" 플로우 추가: 이름, 연락처, 사유 입력 → 게스트 예약 생성 (user_id null, guest_name, guest_phone, **is_admin_added: true**) |
| 사유 저장 | **bookings 테이블에 사유용 컬럼 없음** | DB 마이그레이션: `bookings.admin_note` (text, nullable) 추가 후 저장 |

### 4-C. 워딩: 게스트 ↔ 비회원

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| '게스트' → '비회원' (회원 아닌 사람이 본인 정보로 신청한 경우) | enrollments-view에서 "게스트" 표기 | 로그인 없이 예약한 경우 **"비회원"**으로 표기 (bookings: user_id null, guest_name/guest_phone 있음, is_admin_added false 또는 null) |
| 관리자가 수기로 추가한 사람 → '게스트' 표기 | **bookings.is_admin_added** 이미 존재 | **is_admin_added === true** 인 예약만 "게스트"로 표기. 추가 컬럼 불필요 |

**수정 대상:**  
- `app/academy-admin/components/views/enrollments-view.tsx` (표기 + 수업 선택 UX)  
- `app/academy-admin/components/views/enrollments/admin-add-enrollment-modal.tsx` (이름·연락처·사유 직접 입력 모드 추가)  
- `app/api/bookings/guest/route.ts` 또는 admin 전용 수기 추가 API (사유는 `bookings.admin_note` 사용 — **컬럼 추가 후**)

---

## 5. 수강권 판매 시스템

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 수강권 선택 시 기간제·쿠폰제·워크샵 구분되어 보이도록 | product-view에서 탭으로 구분됨 | 판매(결제) 플로우에서도 기간제/쿠폰제/워크샵 구분 표시 확인 — 결제 페이지·수강권 구매 모달 등 |

**확인 대상:**  
- `app/(main)/book/session/[sessionId]/page.tsx` (구매 가능 수강권 목록 표시)  
- `components/modals/ticket-purchase-modal.tsx`  
- academy-admin 매출/정산 쪽 수강권 선택 UI

---

## 6. 관리자 취소 시 쿠폰제 횟수 복원 옵션

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 관리자가 수강자를 취소해줄 때, 쿠폰제는 "보유 수량을 회원에게 돌려줄지" 선택 가능 | `PATCH /api/bookings/[id]/status` — 취소 시 수강권 복원 로직 없음 | 취소 API에 쿼리 또는 body 파라미터 추가 예: `restoreTicket: boolean`; true일 때 해당 booking이 사용한 user_ticket의 remaining_count 복원 (기간제는 무시) |

**수정 대상:**  
- `app/api/bookings/[id]/status/route.ts`  
- 관리자 출석/신청 관리에서 "취소" 시 옵션 UI(쿠폰제일 때만 "수강권 반환" 체크 등)

---

## 7. 기간제 수강권 수업 신청 로직

### 7-A. 시작일~종료일 자동 수강 신청

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 기간제 수강권: 시작일 설정 시 시작일~종료일 사이 해당 수업에 자동 수강 신청 | `lib/db/period-ticket-bookings.ts`에 일괄 예약 생성 로직 있음 | 구매/발급 시 시작일 선택 → `createBookingsForPeriodTicket` 호출 흐름 확인 및 "연결된 수업만" 포함되도록 검증 |

### 7-B. 연장/일시정지 반영

| 요구사항 | 작업 |
|----------|------|
| 연장·일시정지 승인 시: 해당 기간에는 수강 인원에서 제외, 연장된 기간에는 해당 수업에 다시 명단 포함 | 연장/일시정지 승인 시 기간제 자동 예약 재계산: 기간 변경 반영해 booking 생성/삭제 또는 상태 플래그 처리 |

---

## 8. 수강권 구매 링크

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 수강권별 "구매 링크" 생성 | 미구현 | tickets 또는 user_tickets에 링크용 slug/query (예: ?ticket=xxx&academy=yyy) 생성 기능 |
| 링크 진입 시 학원·수업 정보 확인 후 결제, 기간제는 시작일 선택 | 미구현 | 전용 랜딩 페이지 또는 /payment?ticket=xxx 형태에서 학원명·수업(연결된 클래스) 노출, 기간제 시 "시작일"(연결된 수업 있는 날만 선택) 선택 후 결제 |

**신규:**  
- 링크 생성 API/UI (관리자 수강권 관리)  
- 공개 페이지: 쿼리로 수강권·학원 지정, 기간제 시작일 선택 후 결제 플로우

---

## 9. 수강 신청(결제) 페이지(book) 개선

### 9-A. 현장결제 확인 팝업

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 현장결제 클릭 시 "현장 결제의 경우 결제 선착순 마감으로 수업에 참석하실 수 없을 수 있습니다" 확인 팝업 | `page.tsx`에서 현장결제 시 바로 `handleOnsiteBooking` 호출 | 현장결제 버튼 클릭 시 confirm 팝업 추가 후 진행 |

### 9-B. 비회원 결제 용이

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 비회원: 이름·연락처(또는 이메일)만 입력해 결제 가능 | `/api/bookings/guest`로 이름·연락처로 예약 가능 | 비회원이 "수강권 구매+예약"까지 한 번에 할 수 있는 플로우 추가(이름·연락처·이메일 등 최소 정보), 결제 후 신청자 명단에 비회원으로 표시 |
| **관리자는 신청자 명단에서 비회원 신청도 확인 가능** | enrollments-view에 guest_name/guest_phone 노출 | 출석/신청 관리 탭에서 비회원(guest 필드 있는 예약) 식별·표시 유지 및 필요 시 필터/정렬 지원 |

**수정 대상:**  
- `app/(main)/book/session/[sessionId]/page.tsx` — 현장결제 확인 + 비회원 구매 플로우

---

## 10. 상담 신청 기능

### 10-A. 학원 홈에서 상담 신청

| 요구사항 | 현재 상태 | 작업 |
|----------|-----------|------|
| 특정 학원 홈에서 "상담 신청하기" 노출 및 제출 | 학원 상세 등에 버튼 없음 | 학원 상세 페이지에 "상담 신청" 버튼/폼 추가, 제출 시 consultations 테이블에 INSERT (academy_id 연결) |

### 10-B. 상담 양식

| 요구사항 | 현재 DB | 작업 |
|----------|---------|------|
| 이름, 연락처, 카테고리, 상세 내용, 방문 예정 일시(날짜 + 30분 단위 시각) | consultations: name, phone, **topic**, **scheduled_at**, notes. **category/detail/visit_datetime 없음** | consultations에 `category`(또는 category_id), `detail`(text), `visit_datetime`(timestamptz) 추가 또는 topic/notes/scheduled_at 의미 재정의. 폼에 30분 단위 시간 선택 |

### 10-C. 관리자: 상담 카테고리 추가/삭제

| 요구사항 | 현재 DB | 작업 |
|----------|---------|------|
| 상담 카테고리 추가/삭제, 카테고리별 이름·소요시간(분) | consultations에 category 테이블/컬럼 없음 | **신규 테이블** `consultation_categories` (academy_id, name, duration_minutes) 또는 academies에 Json. **프리셋:** 입시반 30분, 오디션반 30분, 전문반 30분, 일반 상담 10분 (docs/update .md 명시) |

### 10-D. 관리자: 상담 가능 시각 설정

| 요구사항 | 현재 DB | 작업 |
|----------|---------|------|
| 전화 상담 가능 시간, 방문 상담 가능 시간 설정 | 해당 컬럼/테이블 없음 | **신규** academy별 설정 테이블 또는 academies에 Json 컬럼 (예: consultation_availability) |

**수정/신규:**  
- **DB:** consultations 확장(category, detail, visit_datetime 등), consultation_categories 테이블, 상담 가능 시각용 테이블/컬럼. `types/database.ts` 반영  
- `lib/db/academy-admin/consultations.ts` — 카테고리·가능 시간 CRUD  
- `app/academy-admin/components/views/consultation-view.tsx` — 카테고리 관리, 가능 시각 설정 UI  
- 학원 상세 페이지: 상담 신청 폼 + API

---

## 구현 우선순위 제안

| 단계 | 항목 | 비고 |
|------|------|------|
| 1 | 1-A·1-B·1-C 워딩 통일, 4-C 게스트/비회원 표기, 9-A 현장결제 확인 | 표기·안전 확인만, 리스크 낮음 |
| 2 | 4-A 날짜 선택 후 수업명 표기, 4-B 수기 추가 시 이름·연락처·사유 입력 | 신청인원 관리 UX |
| 3 | 5 수강권 판매 화면 기간제/쿠폰제/워크샵 구분 확인, 6 취소 시 쿠폰 반환 옵션 | 판매·취소 정책 |
| 4 | 2-A·2-B 회원 검색/필터 및 수강권 요약/상세 | 회원 관리 강화 |
| 5 | 3 연장/일시정지 전반 (신청·승인·관리자 임의·알림) | DB·API·UI 신규 |
| 6 | 7-B 기간제 연장/일시정지 반영, 8 수강권 구매 링크 | 기간제 로직·수익화 |
| 7 | 9-B 비회원 결제 플로우, 10 상담 신청·카테고리·가능 시각 | 전환율·상담 체계화 |

---

## TODO 진행 현황 (완성 시 체크·상태 업데이트)

아래 TODO를 구현 완료 시 `- [x]`로 바꾸고, 필요 시 비고를 추가하세요.

| ID | 항목 | 상태 | 비고 |
|----|------|------|------|
| 1a | 1-A 기간제 수강권 워딩 + 시작일 선택/첫 수업일 옵션 | ✅ | 워딩 완료. 시작일/첫 수업일 옵션은 기존 period-ticket-bookings 연동 유지 |
| 1b | 1-B 쿠폰제(횟수제) 수강권 워딩 일괄 변경 | ✅ | |
| 1c | 1-C 워크샵(특강) 수강권 워딩 통일 | ✅ | |
| 4-menu | 4 메뉴/화면 워딩 "출석/신청 관리" 통일 | ✅ | 사이드바·대시보드·enrollments 헤더 반영 |
| 4c | 4-C 게스트/비회원 표기 (is_admin_added 기준) | ✅ | 게스트=is_admin_added, 비회원=guest만 있는 경우 |
| 9a | 9-A 현장결제 확인 팝업 | ✅ | book 페이지 현장결제 시 confirm 추가 |
| 4a | 4-A 날짜 선택 후 수업명 class 기준 하나만 | ✅ | 날짜 선택 시 class 드롭다운, 선택 시 해당 class 해당일 전체 |
| db-admin-note | DB: bookings.admin_note 마이그레이션 | ✅ | |
| 4b | 4-B 수기 추가 이름·연락처·사유 직접 입력 | ✅ | admin-add-guest API + 모달 게스트 탭, admin_note 저장 |
| 5 | 5 수강권 판매 화면 기간제/쿠폰제/워크샵 구분 | ✅ | sales-form category, product-selection 뱃지·검색 |
| 6 | 6 취소 시 쿠폰 반환 옵션 (restoreTicket) | ✅ | PATCH status에 restoreTicket, 취소 시 쿠폰제면 반환 여부 선택 |
| 2a | 2-A 회원 목록 검색/필터 보강 | ✅ | 이메일 검색, 상태 필터(전체/수강중/만료예정/휴면) |
| 2b | 2-B 회원 수강권 요약/상세 UI | ✅ | 목록 만료일 컬럼, 상세 모달 수강권 종류·잔여·만료 정리 |
| 3-db | 3 DB: ticket_extension_requests, max_extension_days | ✅ | 마이그레이션 적용 |
| 3-abcd | 3-A~D 연장/일시정지 신청·승인·관리자 임의·알림 | ✅ | /my 수강권 연장 모달, 연장/일시정지 관리 탭, 설정 max_extension_days |
| 7b | 7-B 기간제 연장/일시정지 반영 명단 재계산 | ✅ | PATCH 승인 시 absent 기간 예약 취소, 연장 구간 자동 예약 |
| 8 | 8 수강권 구매 링크 생성 및 랜딩·결제 | ✅ | /book/ticket, product-view 구매 링크 복사 |
| 9b | 9-B 비회원 결제 플로우 + 관리자 명단 확인 | ✅ | purchase-guest API, book/ticket 비회원 폼 |
| 10-db | 10 DB: consultations 확장, consultation_categories 등 | ✅ | 마이그레이션 적용 |
| 10-abcd | 10-A~D 상담 신청·카테고리·가능 시각·프리셋 | ✅ | 학원 상세 상담 신청, 카테고리 CRUD·프리셋, consultation_availability |

---

## 체크리스트 (완료 시 ✓)

- [x] 1-A 기간제 수강권 워딩 및 시작일 선택 제한  
- [x] 1-B 쿠폰제(횟수제) 워딩  
- [x] 1-C 워크샵(특강) 수강권 워딩  
- [x] 2-A 회원 목록 검색/필터  
- [x] 2-B 회원 수강권 요약/상세  
- [x] 3-A~D 연장/일시정지 신청·승인·관리자 임의  
- [x] 4 메뉴/화면 워딩 "출석/신청 관리" 통일  
- [x] 4-A 날짜 선택 후 수업명 표기  
- [x] 4-B 수기 추가 이름·연락처·사유  
- [x] 4-C 게스트/비회원 표기  
- [x] 5 수강권 판매 화면 유형 구분  
- [x] 6 취소 시 쿠폰 반환 옵션  
- [x] 7-A·7-B 기간제 자동 수강·연장 반영  
- [x] 8 수강권 구매 링크  
- [x] 9-A 현장결제 확인 팝업  
- [x] 9-B 비회원 결제  
- [x] 10-A~D 상담 신청·카테고리·가능 시각  

---

## DB 마이그레이션 체크리스트 (재검사 반영)

구현 전 Supabase에 반영할 스키마 변경:

- [x] **bookings**: `admin_note` (text, nullable) — 수기 추가 사유 저장 (마이그레이션 적용됨)
- [x] **ticket_extension_requests** (신규): 연장/일시정지 신청·승인·거절 이력 (마이그레이션 적용됨)
- [x] **academies**: `max_extension_days` (integer, nullable) — 학원별 연장 가능 최대 일수 (마이그레이션 적용됨)
- [x] **consultations**: `category_id`, `detail`, `visit_datetime` 등 확장 (마이그레이션 적용됨)
- [x] **consultation_categories** (신규): academy_id, name, duration_minutes — 상담 카테고리 (마이그레이션 적용됨)
- [x] **상담 가능 시각**: academies.consultation_availability (Json 컬럼, 전화/방문 가능 시간) (마이그레이션 적용됨)

---

## docs/update .md 대조 검증 (완벽성 확인)

아래는 **docs/update .md** 항목별로 계획 반영 여부를 점검한 결과입니다.

| 원문 항목 | 계획 반영 | 비고 |
|-----------|-----------|------|
| **1-A** 기간제 워딩, 시작일 지정(구매/획득 or **첫 수업 일자 기준**), 연결된 수업 있는 날만 선택, 수업 체크 | ✅ | "첫 수업 일자 기준 유효기간 카운팅" 옵션 계획에 명시 반영 |
| **1-B** 쿠폰제 워딩, 이름·횟수별 가격·유효기간, "취미반 쿠폰-1,3,5회 권" 등, 수업 체크 | ✅ | |
| **1-C** 워크샵(특강) 워딩, 이름·수업 체크·유효기간 | ✅ | |
| **2-A** 회원 목록 검색/필터 | ✅ | |
| **2-B** 수강권 종류·개수·유효기간·잔여 횟수 간단 표시, 클릭 시 상세(인적사항·등록일·수강권 종류·유효기간) | ✅ | |
| **3-A** /my에서 기간제·쿠폰 수강권 연장/일시정지 신청 | ✅ | |
| **3-B** 관리자 "수강권 연장/일시정지 관리" 탭, 승인/거절, 사용자 알림, **거절 시 사유 입력** | ✅ | |
| **3-C** 연장 = 수강권 선택 + absent 기간(시작~종료) → 일수만큼 연장, **최대 연장 일수 학원별 관리자 설정** | ✅ | |
| **3-D** 관리자 임의 연장/일시정지 | ✅ | |
| **4** **"출석/신청 관리" 워딩 변경** | ✅ | 섹션 4에 메뉴/화면 워딩 통일 명시 추가 |
| **4-A** 날짜 선택 시 해당 날짜 수업 예정 인원, **날짜 선택 후 수업명은 class 기준 하나만** | ✅ | |
| **4-B** 수기 추가: **이름·연락처·사유 직접 기입**(검색 X) | ✅ | admin_note 컬럼 추가 명시 |
| **4-C** 게스트→비회원, 수기 추가자→게스트 | ✅ | is_admin_added 기준 명시 |
| **5-A** 수강권 선택 시 기간제·쿠폰제·워크샵 구분 표시 확인/개선 | ✅ | |
| **6** 기간제 취소는 상관없음, **쿠폰제 취소 시 보유 수량 회원에게 돌려줄지 선택** | ✅ | restoreTicket 옵션 |
| **7-A** 기간제: 시작일~종료일 해당 수업 **자동 수강신청** | ✅ | |
| **7-B** 연장/일시정지 승인 시 수강 인원에서 빠지고, 늘어난 기간에 명단 추가 | ✅ | |
| **8** 수강권 구매 링크 생성, 링크 진입 시 학원·수업 확인 후 결제, 기간제 시작일(연결된 수업 있는 날만) 선택 | ✅ | |
| **9-A** 현장결제 클릭 시 **확인 팝업** ("현장 결제의 경우 결제 선착순 마감으로…") | ✅ | |
| **9-B** 비회원 이름·연락처(또는 이메일)만으로 결제, **관리자 명단에서 비회원 신청 확인** | ✅ | 9-B에 관리자 명단 확인 요구 반영 |
| **10-A** 학원 홈 상담 신청, 상담관리 탭 연동 | ✅ | |
| **10-B** 양식: 이름, 연락처, **카테고리, 상세 내용, 방문 예정 일시(날짜+30분 단위 시각)** | ✅ | |
| **10-C** 상담 카테고리 추가/삭제, 이름·소요시간(분), **프리셋: 입시반 30분, 오디션반 30분, 전문반 30분, 일반 상담 10분** | ✅ | 프리셋 예시 명시 |
| **10-D** 상담 가능 시각: **전화 상담 가능 시간, 방문 상담 가능 시간** 관리자 설정 | ✅ | |

**결론:** docs/update .md의 10개 대항목·모든 하위 요구(A/B/C/D)가 계획에 반영되어 있으며, 누락된 요구사항 없이 대조 완료. 본 계획서는 원문 기준으로 완벽하게 대응합니다.
