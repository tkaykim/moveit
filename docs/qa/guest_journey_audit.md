# 비회원 여정 전수 감사 보고서

**작성일:** 2026-04-21
**범위:** B-1/B-2 이터레이션 적용 후 비회원(guest) 전 여정 — 조회·신청·결제·관리자 처리·가입 병합·로그인 유도

## 감사 방법

- 직접 파일 열람 + 참조 라인 확인. Explore agent 1차 조사 후 핵심 주장을 원본 코드로 교차검증.
- 실행 확인 아님(코드 리뷰 한정). 마지막 섹션에 staging 검증 필요 항목 별도 표시.

---

## 1. 여정 요약 (현재 동작)

| 단계 | 카드결제 비회원 | 계좌이체 비회원 |
|---|---|---|
| 조회 | `/academy/[id]` / `/book/session/[sid]` 직접 URL 접근 허용 ([app/(main)/book/session/[sessionId]/page.tsx:614](app/(main)/book/session/[sessionId]/page.tsx:614) — 1회성만 허용) | 동일 |
| 입력 폼 | 토스 결제 전 `비회원 정보 입력` 모달 (이름 + 연락처/이메일 중 1) ([page.tsx:1619](app/(main)/book/session/[sessionId]/page.tsx:1619)) | 동일 모달 + 입금자명 drawer ([page.tsx:1704](app/(main)/book/session/[sessionId]/page.tsx:1704)) |
| 서버 | `/api/tickets/payment-order` → guest user 생성·재사용 → 토스 주문 반환 ([payment-order/route.ts:72-98](app/api/tickets/payment-order/route.ts:72)) | `/api/tickets/bank-transfer-order` → guest user 생성·재사용 + `bookings` PENDING 선생성 |
| 확정 | 토스 성공 → `/payment/ticket/success` → `/book/session/[sid]/success?type=purchase` ([ticket/success/page.tsx:63-69](app/(main)/payment/ticket/success/page.tsx:63)) | 관리자 수동 입금확인 → user_ticket + revenue_transaction 즉시 발급 |
| 가입 유도 | **없음** — 회원 전용 success 화면 재사용 | 전용 모달(회원가입/로그인/나중에) ([page.tsx:1848](app/(main)/book/session/[sessionId]/page.tsx:1848)) |
| 병합 트리거 | 가입 시 `signup_with_guest_merge` RPC(이메일 기준) + `/my` 첫 방문 시 `link-guest-bookings` Phase 1–4 ([my-page-view.tsx:237](components/views/my-page-view.tsx:237)) | 동일 |

---

## 2. 심각도별 이슈

### P0 — 즉시 수정 권장 (데이터 손상 또는 관리자 UX 차단)

#### P0-1. 관리자 명단에서 "비회원" 뱃지 사라짐 (B-2 리그레션)
- **파일:** [enrollments-view.tsx:860](app/academy-admin/components/views/enrollments-view.tsx:860)
- **코드:** `const isNonMember = !user && (enrollment.guest_name || …);`
- **문제:** B-2에서 `bank-transfer-order`/`payment-order`가 guest user(is_guest=true)를 생성해 `booking.user_id`를 채우기 시작했음. 이제 쿼리의 `users (*)` 조인이 guest row를 리턴하므로 `user`가 truthy → `isNonMember=false` → "비회원" 뱃지가 노출되지 않음. 관리자가 신규 비회원 주문을 회원 주문과 육안으로 구분 불가.
- **수정 방향:** `const isNonMember = !!user?.is_guest || (!user && !!enrollment.guest_name);` — `users.is_guest` 플래그 기반으로 판정. `isGuest` (admin-added) 분기와의 의미 충돌 확인 필요.

#### P0-2. 가입 직후 자동 병합 타이밍 불명확
- **파일:** [AuthContext.tsx:278-281](contexts/AuthContext.tsx:278), [my-page-view.tsx:237](components/views/my-page-view.tsx:237)
- **문제:** `signUp`/`signIn` 성공 직후에는 `signup_with_guest_merge` RPC(서버 단 guest user 병합)만 호출. `link-guest-bookings`(booking·bank_transfer_orders·user_ticket 소급발급·GUEST_MERGED 로그)는 사용자가 `/my`에 진입해야 실행. 가입 직후 `/book/session/[sid]/success`나 `/my/tickets`로 이동하는 경로에서는 Phase 1–4 미실행 상태로 화면이 그려질 수 있음.
- **실증 케이스:** S1 시나리오(카드결제 → 가입) 현재는 계좌이체 완료 모달에서만 `/my`로 유도하므로 실제로는 `/my` 경유 보장됨. 하지만 카드결제 성공 후 `type=purchase` 경로에서 `/my/tickets`로 리다이렉트되면 `my-page-view`가 아닌 `my/tickets/page`가 렌더되어 Phase 1–4가 호출되지 않을 가능성.
- **수정 방향:** `AuthContext.signUp`/`signIn` 성공 직후 `fetch('/api/me/link-guest-bookings', POST)` 1회 호출(비동기, 실패해도 UI 차단 안 함). 혹은 `/my/*` 공통 layout에서 호출.

### P1 — 명확한 UX 문제

#### P1-1. 카드결제 비회원, 결제 후 가입 유도 없음
- **파일:** [payment/ticket/success/page.tsx:63-69](app/(main)/payment/ticket/success/page.tsx:63), [book/session/[sessionId]/success/page.tsx:25-43](app/(main)/book/session/[sessionId]/success/page.tsx:25)
- **문제:** 카드결제 성공 리다이렉트 → `type=purchase` 분기로 "수강권이 차감되었습니다" 문구만 표시. `type=guest`에만 있는 **회원가입 CTA 카드가 렌더되지 않음**. 계좌이체 성공 모달에는 있는 가입/로그인 CTA가 카드결제에는 없어 일관성 결여.
- **결과:** 비회원 카드결제 사용자는 예약 내역 조회 경로가 없음을 인지하지 못함. `/my/tickets` 버튼을 눌러도 로그인으로 튕김.
- **수정 방향:** payment-order 응답에 `isGuest` 플래그 추가 → success 페이지에서 `type=purchase&isGuest=1`이면 가입 CTA 렌더. 이메일 프리필 파라미터 추가.

#### P1-2. 가입 CTA 이메일·이름 프리필 부재
- **파일:** [book/session/[sessionId]/success/page.tsx:58](app/(main)/book/session/[sessionId]/success/page.tsx:58)
- **문제:** `router.push('/my?tab=signup')` — 결제 시 입력한 이름/이메일/전화가 가입 폼에 전달되지 않음. 사용자가 동일 값을 재입력해야 하고, 오타로 이메일 불일치 시 병합 실패.
- **수정 방향:** `/my?tab=signup&email=...&name=...&phone=...` 쿼리 전달 후 `MyTab`이 초기값으로 채움.

#### P1-3. guest 이메일이 기존 회원과 충돌 시 무음 귀속
- **파일:** [payment-order/route.ts:73-77](app/api/tickets/payment-order/route.ts:73), [bank-transfer-order/route.ts](app/api/tickets/bank-transfer-order/route.ts) 동일 패턴
- **코드:** `ilike('email', email).limit(1).single()` — `is_guest` 필터 없음
- **문제:** 사용자 A가 `a@x.com`으로 정식 회원, 사용자 B가 비회원 결제 폼에 오타로 `a@x.com` 입력하면 **B의 결제/티켓이 A의 계정에 귀속**. A에게 알림 없이 발생.
- **완화 요소:** 이메일 unique index, 실제 오타 빈도 낮음.
- **수정 방향:** 매칭 시 `is_guest=true` 필터 추가. 정식 회원 email 매칭 시에는 "이 이메일은 이미 가입된 회원입니다. 로그인 후 결제해주세요" 에러 반환 또는 로그인 모달 유도.

#### P1-4. `/my/tickets`, `/my/bookings` 비로그인 접근 시 컨텍스트 유실
- **현상:** 비회원이 카드결제 후 자동 리다이렉트된 `/my/tickets`에서 로그인 페이지로 튕김. 로그인 복귀 URL 미보존 확인 필요.
- **수정 방향:** 이들 경로 미들웨어/가드에서 `?returnTo=` 보존 후 로그인 성공 시 복귀.

### P2 — 개선 기회

#### P2-1. 동일 이메일·타 학원 중복 guest user
- **파일:** payment-order/bank-transfer-order 매칭 로직
- **문제:** 동일 이메일 A학원 결제 → guest row 생성(phone=010-1111). 이후 B학원 결제 시 같은 이메일이면 기존 row 재사용(✓) — 실제 중복 생성은 방지됨. 하지만 **다른 이메일 + 동일 전화**로 결제 시 phone 매칭이 trigger되어 기존 guest 이메일 덮어쓰기 가능(`.update` 없음 — 현재는 재사용만). 정확히는 덮어쓰지 않지만, 두 이메일이 한 guest user에 공존하지 못하므로 나중에 가입 시 **두 이메일 중 하나로만 병합**.
- **수정 방향:** phone으로 재사용할 때 이메일이 다르면 경고 로그 + 신규 row 생성 고려. 혹은 가입 병합 RPC가 "동일 전화 + 동일 이름" 보조 매칭도 수행.

#### P2-2. `isGuestBooking` 판정이 `guest_name` 존재에 의존
- **파일:** [bookings/[id]/status/route.ts:74](app/api/bookings/[id]/status/route.ts:74)
- **코드:** `const isGuestBooking = !!currentBooking.guest_name;`
- **문제:** 관리자가 수동으로 회원 예약을 추가하며 guest_name에 별칭을 채웠거나, 병합 이후 guest_name이 그대로 보존되는 경우(의도적) → 회원 예약도 guest payload가 activity log에 붙음. 기능 오류는 아니지만 보고서 상 오해 소지.
- **수정 방향:** `users.is_guest` 같이 확인 (`!!currentBooking.guest_name && !currentBooking.user_id?`는 안 됨 — user_id는 guest user로 채워지므로). `users(is_guest)` 조인 후 검사.

#### P2-3. 비회원 QR 자가체크인 불가 (설계 상 제약)
- **파일:** [api/attendance/qr-generate/route.ts:14](app/api/attendance/qr-generate/route.ts:14)
- **문제:** `getAuthenticatedUser` 필수 → guest 토큰 없음 → 401. 비회원은 항상 관리자 수동 체크인 필요.
- **판단:** 현재 정책과 부합(비회원 최소화). 문서화만 필요. 대안은 결제 완료 화면에 "현장용 QR" 표시(서명 토큰은 guest user.id로 서버 측 발급) — 구현 시 보안 영향 검토.

#### P2-4. 관리자 bank-transfer-confirm 비회원 UX 피드백
- **파일:** [bank-transfer-confirm/route.ts](app/api/academy-admin/[academyId]/bank-transfer-confirm/route.ts)
- **문제:** 입금확인 성공 시 관리자에게 "user_ticket 발급 완료 / 회원 경로로 처리됨" 등 메시지가 단순. 비회원 주문 특유의 "회원가입 안내 링크 공유" 등 액션 부재.
- **수정 방향:** 확인 성공 응답에 `guestEmail/phone` 포함 → 관리자 화면에서 가입 유도 링크(카톡/문자) 발송 버튼 표출.

#### P2-5. 대소문자·하이픈 정규화는 적용됐으나 일부 Legacy row 고아
- **파일:** [link-guest-bookings/route.ts](app/api/me/link-guest-bookings/route.ts) Phase 1–2
- **문제:** B-2 이전에 저장된 `bookings.guest_email` / `bank_transfer_orders.orderer_email`는 대소문자 혼재 상태일 수 있음. Phase 1의 `.ilike` 매칭은 커버하지만, Phase 2의 `eq` 경로 일부에 원본 값 사용 흔적 있음 확인 필요.
- **수정 방향:** 일회성 백필 마이그레이션(`UPDATE … SET email = lower(trim(email))`) — 별도 이터레이션.

---

## 3. 회귀 확인 (정상 동작 재확인됨)

- ✅ 계좌이체 비회원 성공 모달 → 가입/로그인 CTA 2버튼 + "나중에" 옵션 ([page.tsx:1863](app/(main)/book/session/[sessionId]/page.tsx:1863))
- ✅ 계좌이체 신청 직후 입금 안내 drawer(계좌·금액·예금주·입금자명 한꺼번에 복사) ([page.tsx:1725](app/(main)/book/session/[sessionId]/page.tsx:1725))
- ✅ 관리자 입금확인 즉시 `user_ticket`/`revenue_transaction` 발급(B-2), revert 시 원복(REFUND log)
- ✅ 이메일·전화 정규화 공통 유틸 통일 ([lib/utils/guest-normalize.ts](lib/utils/guest-normalize.ts))
- ✅ `signup_with_guest_merge` RPC v2 ON CONFLICT로 Case C 자동 복구
- ✅ `GUEST_MERGED` activity log 기록 + 영향받은 학원별 1건씩
- ✅ ABSENT 상태 도입 + `current_students`에서 제외 + activity log(`ABSENT_MARKED`/`CLEARED`)
- ✅ 관리자 명단 검색에서 `guest_name`/`guest_phone`/`guest_email` 포함 ([enrollments-view.tsx:264](app/academy-admin/components/views/enrollments-view.tsx:264))
- ✅ `/academy-admin/.../enrollments` 상태 전이 시 guest payload가 activity log에 보존
- ✅ 비회원 카드결제 customer key `guest_${orderId}` 분리 → 토스 고객 식별 충돌 방지
- ✅ 다회권/기간권 비회원 차단 응답 ([payment-order/route.ts:100-103](app/api/tickets/payment-order/route.ts:100)) — "비회원 = 1회성만" 정책 일관

---

## 4. 정책 판단 요청 (설계 결정 필요)

### Q1. 비회원에게 수강권(여러 회차) 보유를 허용할 것인가?
- 현재 정책: 1회성만. 이유: auth 없이 잔여횟수·기간권 관리 시 보안·UX 리스크.
- 대안: 이메일·전화 입력하면 임시 토큰(유효 72h) 발급 → 링크로 "내 예약" 접근 가능. 단, 링크 공유 시 보안 주의.
- **권장:** 현재 정책 유지. 다회권 필요 시 가입 강제가 타당.

### Q2. `users.is_guest=true` row를 공개 플랫폼 조회에서 어떻게 다룰지
- 현재: RLS는 기본 정책만. is_guest row가 일부 쿼리(학원 학생 목록 등)에 노출될 가능성 점검 필요(별도 감사 대상).

### Q3. 가입 없이 "내 예약 조회" 공개 페이지 제공 여부
- 사용자 입장: "방금 결제했는데 어디서 확인?"
- 해결 방향 2가지:
  - (A) 가입 강제(현재 가까움) — CTA만 강화
  - (B) 이메일+주문번호 조회 페이지 — 구현 필요
- **권장:** A를 우선하되, 카드결제 success 화면 P1-1 수정으로 충분할 것.

---

## 5. 로그인/가입 유도 타이밍 종합 점검

| 지점 | 현재 | 평가 |
|---|---|---|
| 세션 페이지에서 다회권 선택 | "로그인이 필요합니다" 인라인 안내 ([page.tsx:1337](app/(main)/book/session/[sessionId]/page.tsx:1337)) | ✅ |
| 계좌이체 선택 | 로그인/회원가입/비회원 3버튼 모달 ([page.tsx:1570](app/(main)/book/session/[sessionId]/page.tsx:1570)) | ✅ |
| 비회원 계좌이체 완료 | 가입/로그인/나중에 3버튼 | ✅ |
| 비회원 카드결제 완료 | **가입 CTA 없음** → `/my/tickets` 리다이렉트 | ❌ (P1-1) |
| 비회원 현장결제 완료 | `type=guest` 가입 CTA | ✅ |
| `/my/*` 비로그인 진입 | 로그인 요구 (복귀 URL 보존 여부 확인 필요) | ⚠ (P1-4) |
| 가입 후 병합 | `signup_with_guest_merge` 즉시 + `link-guest-bookings` `/my` 진입 시 | ⚠ (P0-2) |
| 가입 시 "이미 가입된" 에러 | Case B/C 분기 + 로그인 탭 자동 전환 | ✅ (P0-2 이터레이션) |

---

## 6. 우선순위 제안

| 순번 | 작업 | 파일 | 작업량 |
|---|---|---|---|
| 1 | `isNonMember` → `users.is_guest` 기반으로 재정의 | enrollments-view.tsx 860 및 유관 뱃지 | XS |
| 2 | `AuthContext.signUp/signIn` 성공 시 `link-guest-bookings` 호출 | AuthContext.tsx | XS |
| 3 | 카드결제 성공 화면 `isGuest` 분기 + 가입 CTA | payment-order 응답 + success/page.tsx | S |
| 4 | 가입 CTA 이메일/이름 프리필 | success/page.tsx → MyTab 쿼리 수신 | S |
| 5 | guest 매칭 시 `is_guest=true` 필터 + 정식 회원 충돌 에러 | payment-order, bank-transfer-order | XS |
| 6 | `isGuestBooking` → `users.is_guest` 기반 | bookings/[id]/status/route.ts | XS |
| 7 | 관리자 bank-transfer-confirm 비회원 가입 링크 공유 | 응답 + 관리자 UI | M (선택) |

**권장 이터레이션 구성:** 1·2·5·6은 한 PR로 묶기(소규모 결함 정리). 3·4는 "카드결제 비회원 여정 마무리" 전용 PR. 7은 별도 논의.

---

## 7. Staging 검증 체크리스트 (코드 변경 후)

- [ ] P0-1: 신규 비회원 계좌이체/카드결제 → 관리자 enrollments에 "비회원" 뱃지 표시 여부
- [ ] P0-2: 카드결제 직후 가입 → 로그 타임스탬프 순서(`INSERT auth.user` → `signup_with_guest_merge` → `GUEST_MERGED` log)
- [ ] P1-1: 비회원 카드결제 완료 → 회원가입 CTA 노출 → 이메일 프리필 → 가입 → `user_tickets` 1건
- [ ] P1-3: 기존 회원과 동일 이메일로 비회원 시도 → 차단 또는 알림 발송 여부
- [ ] P2-5: Legacy guest row(대문자 이메일) 가입 → 병합 성공 여부
