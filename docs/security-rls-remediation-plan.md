# 보안 잠금(RLS·권한) 시정 계획 — 설계/마이그레이션 초안 (미적용)

> 상태: **설계만**. 아래 SQL·코드 변경은 **아직 적용하지 않음**. 대표님 검토 후 단계적 적용.
> 배경: 감사 결과 public 43개 테이블 중 29개가 RLS 비활성이고, `anon`/`authenticated` 역할에
> 민감 테이블 전반의 `SELECT/INSERT/UPDATE/DELETE`(+TRUNCATE) 권한이 열려 있음.
> 브라우저 번들의 anon 키로 Supabase REST를 직접 호출하면 앱을 우회해 **전 학원 데이터 read/write** 가능.
> (권한 상승: `academy_user_roles` self-INSERT로 임의 학원 OWNER, `users.role` self-UPDATE로 SUPER_ADMIN)

## ⚠️ 적용 시 앱이 멈출 수 있는 이유 (반드시 단계적으로)
현재 브라우저는 **anon 클라이언트로 거의 모든 테이블을 직접 read/write** 한다(학생 앱·학원 관리자 화면 다수).
RLS를 켜고 권한을 REVOKE 하면, 적절한 정책이 없거나 클라이언트 쓰기를 서버 API로 옮기지 않은 화면은
즉시 빈 화면/실패가 된다. 따라서 **읽기 정책을 먼저 깔고 → 검증 → 쓰기 REVOKE → 검증** 순서 필수.

## 권장 적용 순서 (4단계)

### Phase 0 — 준비 (코드)
- 민감 테이블 **쓰기를 서버 API(service-role)로 이전**: 매출/수강권/예약/역할/계좌이체/빌링.
  현재 브라우저에서 직접 INSERT/UPDATE 하는 지점 목록(아래 "영향 코드")을 서버 라우트로 교체.
- `/academy-admin/*`, `/admin/*` 레이아웃에 **서버측 인가** 추가(현재 클라이언트 게이트뿐).

### Phase 1 — 즉시 차단 (가장 위험한 권한 상승부터, 읽기 영향 적음)
```sql
-- 역할 자가 승격 차단: users.role 컬럼 쓰기 회수
REVOKE UPDATE (role) ON public.users FROM anon, authenticated;
-- 관리자 역할 부여 테이블: 브라우저 직접 쓰기 전면 차단 (읽기는 정책으로)
ALTER TABLE public.academy_user_roles ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.academy_user_roles FROM anon, authenticated;
CREATE POLICY aur_self_read ON public.academy_user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM academy_user_roles m
                    WHERE m.academy_id = academy_user_roles.academy_id
                      AND m.user_id = auth.uid()
                      AND m.role IN ('ACADEMY_OWNER','ACADEMY_MANAGER')));
-- 역할 부여/회수는 service-role API에서만.
```

### Phase 2 — 금융·개인정보 테이블 (읽기 정책 + 쓰기 REVOKE)
대상: `revenue_transactions`, `user_tickets`, `bank_transfer_orders`, `user_ticket_payment_orders`,
`subscription_payments`, `instructor_salaries`, `billing_webhook_events`.
```sql
ALTER TABLE public.revenue_transactions ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.revenue_transactions FROM anon, authenticated;
-- 학원 스태프만 자기 학원 매출 조회
CREATE POLICY rt_academy_staff_read ON public.revenue_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM academy_user_roles r
                 WHERE r.academy_id = revenue_transactions.academy_id
                   AND r.user_id = auth.uid()
                   AND r.role IN ('ACADEMY_OWNER','ACADEMY_MANAGER')));
-- 본인 결제 내역은 별도 정책(또는 서버 API /payment-history 로만 노출)
CREATE POLICY rt_self_read ON public.revenue_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```
`user_tickets`(본인 `user_id=auth.uid()` + 학원 스태프), `bank_transfer_orders`(스태프),
나머지도 동일 패턴. 쓰기는 전부 service-role API.

### Phase 3 — 운영 데이터 (공개읽기 vs 스태프쓰기 분리)
- 공개 읽기 필요(스토어프론트): `academies`, `classes`, `schedules`, `tickets`, `instructors`, `banners`,
  `dance_categories` → `CREATE POLICY ... FOR SELECT USING (true)` 후 **쓰기는 스태프/서비스만**.
- 내부 전용: `consultations`, `daily_logs`, `operation_notes`, `enrollment_activity_log`, `academy_students`
  → 스태프 멤버십 정책.
- `banners`/`banner_settings`/`dance_categories`: 정책은 있으나 **RLS 비활성**(정책 死) →
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` 로 활성만 하면 기존 정책이 작동.
- 과허용 정책 교체: `ticket_classes`(`USING(true) FOR ALL`), `academy_notification_settings`(`USING(true)`)
  → academy 멤버십 검사로.

### Phase 4 — 키 정리
- 레거시 anon 키(2082 만료, 공개 노출)는 publishable 키로 전환하고, anon 키는 "완전 공개"로 간주.

## 영향 코드 (RLS 켜기 전 서버 API로 이전/정책 보강 필요)
- 브라우저 직접 쓰기: `student-register-modal`(users update/insert), 각 academy-admin 뷰의
  classes/schedules/instructors/discounts/tickets 직접 CRUD, `delete-recurring-sessions`(client),
  `student-view`/`enrollments-view` 등 `getSupabaseClient()` 쓰기 경로 — 전수 목록은 적용 직전 재grep.
- 무인증/IDOR API(별도 즉시 수정 권장, RLS와 독립): `bookings/[id]/status`, `bookings/admin-add`,
  `bookings/admin-add-guest`, `consultation-categories/*`, `academies/[id]/update-slug`,
  `user-tickets/[id]/extend`, `ticket-extension-requests/[id]`(authz 없음).
- 서버측 레이아웃 인가: `app/academy-admin/[academyId]/layout.tsx`, `app/admin/**`.

## 결제/정산 치명 항목 (이번 범위 밖 — 별도 결정 필요)
- 토스 웹훅 서명 미검증(시크릿 미설정 시 통과) → 이벤트 위조.
- `change-plan` 카드 승인 실패에도 업그레이드 적용(무료 업그레이드).
- `auto-charge` 기간 멱등성 없음 → 재시도/중복 cron 이중청구, `CRON_SECRET` 미설정 시 외부 트리거.
- `academy_subscriptions(academy_id)` unique 부재 → 구독 중복행 → `.single()` 파손.

## 검증 체크리스트(각 Phase 후)
1. 학생 앱: 로그인/내 수강권/예약/결제 정상.
2. 학원 관리자: 대시보드·매출·출석/신청·수강권·일정 CRUD 정상.
3. 슈퍼 관리자: /admin 정상.
4. 음성 테스트: anon 키로 REST 직접 호출 시 타 학원/타 사용자 데이터 read/write 차단 확인.
