# 보안 모델 — 누가 무엇을 할 수 있는가

## 원칙

**RLS가 방어선이고, 서버 코드는 그 위에 있다.** 화면에서 가리는 것은 보안이 아니다 — 숨겨야 할 데이터는 REST 응답 자체에 없어야 한다.

## 잠긴 것 (되돌리지 말 것)

| 대상 | 규칙 |
|---|---|
| `user_tickets` | 학생이 자기 수강권을 **직접 INSERT 할 수 없다**. 발급은 결제 확정 RPC / 멤버십 부여 RPC / 관리자 서버 경로만. |
| `bookings` | 학생이 자기 예약 행을 임의 상태로 **직접 UPDATE 할 수 없다**. 취소는 소유권·상태 전이·취소 기한을 검사하는 서버 경로로만. 출석(`COMPLETED`/`ABSENT`) 전이는 **학원 직원만**. |
| `classes` / `schedules` | 공개 SELECT가 **audience 조건부**다. `audience_membership_id`가 걸린 수업은 그 멤버십 활성 보유자와 학원 직원에게만 보인다. |
| 횟수 조작 RPC | `consume_ticket_count` / `restore_ticket_count`의 public·anon·authenticated EXECUTE를 회수했다. 브라우저에서 꼭 필요한 경로는 **직원 검사를 내장한 전용 함수**로 따로 뚫었다. |
| 신규 테이블 | `class_groups`·`memberships`·`membership_discounts`·`booking_events` = 직원/서비스 전용. `student_memberships`·`order_groups`·`order_items` = 본인 또는 학원 직원. |

## 함정 — 실제로 물렸던 것들

**1. `current_user` vs `session_user`**
SECURITY DEFINER 함수 안에서 `current_user`는 **정의자(postgres)**다. 서비스 롤 판별을 `current_user`로 하면 함수 내부에서 항상 참이 되어 **소유권·직원 검사가 통째로 무력화**된다. 실제로 이 상태로 한 번 배포됐고, 인증된 사용자가 남의 ID로 예약을 만들 수 있었다. 판별은 `session_user` 기준(`booking_is_service_role()`)으로 한다.

**2. Supabase의 기본 EXECUTE 부여**
새로 만든 함수에는 anon/authenticated EXECUTE가 **자동으로 붙는다**. 함수를 만들면 반드시:
```sql
REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ... TO service_role;  -- 필요한 롤에만
```
그리고 `SET search_path = public, pg_temp` 고정 + 내부 권한 검사를 함께 둔다.

**3. `createClient()` ≠ 서비스 롤**
`lib/supabase/server.ts`의 `createClient()`는 **쿠키 기반, RLS 적용** 클라이언트다. 서비스 롤은 `createServiceClient()`다. 이름만 보고 반대로 가정하면 RLS를 잠근 순간 핵심 경로(예: 예약 시 수강권 차감)가 조용히 죽는다.

**4. RLS를 우회해 읽고 클라이언트에서 거르는 패턴**
학생 화면 데이터 레이어가 서비스 롤로 읽고 있으면 RLS가 아무 의미가 없다 — 멤버십 전용 수업이 전원에게 보였다. 학생 경로는 **사용자 세션 클라이언트**로 읽는다.

**5. 정책이 자격자까지 막는 실수**
audience 제한 정책을 "직원만"으로 쓰면 **정작 그 멤버십을 가진 학생도 자기 수업을 못 본다**. 자격자 조건을 반드시 포함한다.

## 남아 있는 부채 (이번 범위 밖 — 실오픈 전 판단 필요)

- 이 도메인과 무관한 **기존 12개 테이블에 RLS가 꺼져 있다**(장기 advisory). 이번 사이클은 예약·결제·수강권과 직접 닿는 표면만 잠갔다.
- 여러 SECURITY DEFINER 함수가 `authenticated` 실행 가능으로 남아 있다. 각각 내부 권한 검사를 갖고 있어 의도된 설계지만, 목록은 주기적으로 재확인할 가치가 있다.
- 운영자 화면 밖의 일부 GET 라우트가 캐시 무효화 처리 전이다(별도 작업으로 분리됨).

## 공격 테스트

`tests/security-rls.spec.ts` + `tests/e2e-scenarios.spec.ts`의 보안 스윕이 **anon 키와 학생 JWT 양쪽으로** 실제 REST/RPC를 때려서 거부되는지 확인한다. 보안 관련 변경 후에는 이 두 스펙이 통과해야 한다.
