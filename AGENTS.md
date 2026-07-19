# moveit — 에이전트 작업 기준

이 레포에서 코드를 고치기 전에 읽는다. 전역 규칙은 `~/.claude/`, 여기는 **이 프로젝트의 도메인·보안·운영 지식**이다.

| 알고 싶은 것 | 문서 |
|---|---|
| 예약·수강권·멤버십·주문이 어떻게 맞물리는가 | [docs/booking-domain.md](docs/booking-domain.md) |
| 누가 무엇을 할 수 있는가 (RLS·RPC·함정) | [docs/security-model.md](docs/security-model.md) |
| 크론·큐·시드·다크런치 상태 | [docs/booking-operations.md](docs/booking-operations.md) |
| MID 학원 실오픈 준비도 | [docs/mid-whitelabel-readiness.md](docs/mid-whitelabel-readiness.md) |

## 이 프로젝트가 무엇인가

학원이 **자기 학원 전용 앱**을 갖는 것이 제품의 본질이다(마켓플레이스가 아니다).
플랫폼(moveit)이 DB·결제·로직을 소유하고, 학원은 **데이터로 표현된 스킨과 규칙**으로 존재한다.
따라서 **특정 학원 이름·slug로 코드가 분기하면 안 된다.** 학원마다 다른 것은 전부 설정 데이터여야 하고, 새 학원은 데이터만으로 추가돼야 한다.

## 절대 규칙

1. **파괴적 DB 작업 금지.** DELETE / DROP / TRUNCATE 금지, additive 마이그레이션만. 애플리케이션 런타임의 "삭제"는 소프트(`is_active=false`)로 표현한다.
2. **`types/database.ts` 전체 재생성 금지** — 수기 섹션이 있다. 부분 편집만.
3. **같은 DB를 쓰는 외부 앱을 깨뜨리지 않는다.** `mid-class-board`가 service role로 `classes`/`schedules`/`recurring_schedules`/`schedule_meta`를 직접 쓴다. 그 앱은 새 예약 도메인을 모른다 — 그래서 태깅 안 된 수업은 "예약 준비 안 됨"으로 남는 것이 **정상 동작**이다.
4. **`academies.is_active`를 임의로 켜지 않는다.** 학생 노출 전환은 사람의 결정이다.
5. **결제 승인과 내부 이행은 하나의 트랜잭션이 될 수 없다.** PG 승인 후 DB 실패는 `PAYMENT_APPROVED`/`FULFILLMENT_FAILED`로 남기고 멱등 재시도한다 — 승인을 조용히 잃지 않는다.
6. **환불은 자동 집행하지 않는다.** 계산된 제안을 스태프가 확인하고, 조정은 사유와 함께 감사 기록으로 남는다.

## 이 코드베이스에서 반복적으로 물린 함정

- **`createClient()`는 RLS가 걸리는 쿠키 클라이언트, `createServiceClient()`가 서비스 롤이다.** 이름만 보고 반대로 가정하면 예약 생성 같은 핵심 경로가 조용히 죽는다.
- **SECURITY DEFINER 안에서 `current_user`는 정의자(postgres)다.** 서비스 롤 판별은 `session_user`로 한다 — 이걸 틀리면 권한 검사가 통째로 무력화된다(실제로 한 번 그렇게 나갔다).
- **Supabase는 새 함수에 anon/authenticated EXECUTE를 자동 부여한다.** 함수를 만들면 반드시 REVOKE하고 필요한 롤에만 GRANT한다.
- **Next의 Data Cache는 재시작을 넘어 지속된다.** 서버에서 Supabase를 읽는 경로는 캐시를 끄지 않으면 삭제된 행을 계속 보여준다. 현재는 클라이언트 팩토리에서 `cache: 'no-store'`로 차단해 두었다 — 이 방어를 되돌리지 않는다.
- **Postgres에서 `record IS NOT NULL`은 "모든 필드가 non-null"이다.** 존재 검사로 쓰면 항상 false가 된다.
- **jsonb는 키 순서를 재정렬한다.** `JSON.stringify` 비교로 멱등성을 판단하면 매번 다르다고 나온다.
- 테스트는 **`--workers=1`**. 라이브 DB를 공유하므로 병렬 실행 시 픽스처가 서로를 밟는다.

## 작업 방식

- 규칙을 코드에 새기지 말고 **데이터(설정)로 표현**한다. 예약 창구 시각, 커버리지, 혜택, 환불 기준 전부 학원별 데이터다.
- 판정과 변경을 분리한다. 사전 검증은 부작용 없는 함수로, 실제 확정은 **행 잠금 후 재검증하는 DB 트랜잭션**으로 한다. 화면이 통과시킨 것을 서버가 믿지 않는다.
- 실패는 조용히 넘기지 않는다. 처리 못 한 것은 **운영자가 볼 수 있는 큐**로 남긴다(재처리 대시보드).
