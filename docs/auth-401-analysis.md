# 401 "로그인이 필요합니다" 원인 분석

## 원인 정리

### 1. 인증 이중 경로 (쿠키 vs Bearer)
- **서버**: `getAuthenticatedUser(request)` → Bearer 먼저 확인 → 없으면 쿠키(createClient)로 fallback
- **클라이언트**: `fetchWithAuth` → `getAuthHeaders()`로 access_token을 `Authorization: Bearer`로 전달

### 2. "한번씩" 401이 나는 이유
| 상황 | 쿠키 전달 | Bearer 전달 | 결과 |
|------|-----------|-------------|------|
| fetchWithAuth 사용 | ✅ | ✅ | 인증 성공 |
| plain fetch 사용 | 상황에 따라 | ❌ | **쿠키 실패 시 401** |
| getSession() 시점 이슈 | - | ❌ (null) | **401** |

**쿠키가 실패하는 경우**: Safari ITP, 시크릿 모드, 일부 브라우저, 서드파티 쿠키 제한, SSR/미들웨어 타이밍 등

### 3. getAuthHeaders() 가능 이슈
- `supabase.auth.getSession()`은 로컬 스토리지 기반
- 페이지 로드 직후, Supabase 클라이언트 복원 전에 호출되면 `session`이 null일 수 있음
- 만료된 access_token을 보내도 서버 `getUser(token)`에서 실패 가능

---

## fetchWithAuth 미적용 (plain fetch) → 401 위험

| 파일 | API | 용도 |
|------|-----|------|
| `components/views/payment-view.tsx` | `/api/user-tickets` | 결제 시 수강권 목록 |
| `components/modals/booking-confirm-modal.tsx` | `/api/user-tickets`, `/api/bookings` | 예약 확인 모달 |
| `app/(main)/payment/page.tsx` | `/api/bookings` | 결제 처리 |
| `app/(main)/payment/success/page.tsx` | `/api/user-tickets` | 결제 완료 후 수강권 수 |
| `app/(main)/book/ticket/page.tsx` | `/api/tickets/purchase` | 수강권 구매 |
| `components/modals/ticket-purchase-modal.tsx` | `/api/tickets/purchase` | 수강권 구매 모달 |
| `components/modals/ticket-recharge-modal.tsx` | `/api/tickets/purchase` | 수강권 충전 모달 |
| `components/views/academy-detail-view.tsx` | `/api/favorites` | 즐겨찾기 |
| `components/views/academy-list-view.tsx` | `/api/favorites` | 즐겨찾기 |
| `components/views/academy-map-view.tsx` | `/api/favorites` | 즐겨찾기 |
| `components/views/dancer-list-view.tsx` | `/api/favorites` | 즐겨찾기 |
| `components/views/dancer-detail-view.tsx` | `/api/favorites` | 즐겨찾기 |
| `components/views/saved-view.tsx` | `/api/favorites` | 즐겨찾기 |
| `components/modals/ticket-extension-request-modal.tsx` | `/api/ticket-extension-requests` | 연장 신청 |
| `app/academy-admin/.../qr-reader-view.tsx` | `/api/attendance/qr-checkin` | QR 출석 |
| `components/modals/qr-modal.tsx` | `/api/attendance/qr-generate` | QR 생성 |
| `app/academy-admin/.../settings-view.tsx` | `/api/upload/image` | 이미지 업로드 |
| `app/academy-admin/.../extension-requests-view.tsx` | `/api/ticket-extension-requests` | 연장 요청 |
| `app/academy-admin/.../admin-extension-create-modal.tsx` | `/api/ticket-extension-requests/admin` | 관리자 연장 생성 |

---

## 수정 완료 요약 (2025-02)
- 모든 인증 필요 API 호출에 `fetchWithAuth` 적용
- user-tickets, bookings, tickets/purchase, favorites, ticket-extension-requests, attendance, upload/image 등
- 해당 API 서버 측에 `getAuthenticatedUser` / `getAuthenticatedSupabase` 적용 (Bearer 지원)

## 이미 fetchWithAuth 적용됨
- `app/(main)/book/session/[sessionId]/page.tsx` - 예약
- `components/views/my-page-view.tsx`
- `components/views/my-tickets-section.tsx`
- `components/views/my-bookings-section.tsx`
- `components/views/my-bookings-view.tsx`
- `components/views/tickets-view.tsx`
- `components/views/payment-history-view.tsx`
