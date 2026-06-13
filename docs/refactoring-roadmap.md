# 무빗(moveit) 리팩토링 로드맵

> 최종 갱신: 2026-06-10
> 성격: 살아있는 문서. 단계 완료/결정 변경 시 같은 turn에 갱신한다.
> 결정권자: 대표님. 본 문서는 합의된 도메인 규칙·작업 순서의 정본(SSoT)이다.

---

## 0. 핵심 판단 (왜 이렇게 가는가)

실측 결과 이 앱은 **75~80% 완성**이며, 복잡한 기능(반복배치, 연장/일시정지, QR 출석, 게스트 4단계 병합, 3종 결제경로)이 **이미 구현되어 동작**한다.

- ❌ **전면 재작성(scratch rewrite)** — 동작하는 자산을 버리고 같은 복잡도에 재도달. 기각.
- ❌ **스키마 리셋 후 코드 이전** — 89개 라우트·`lib/db`가 현 스키마에 깊게 결합. 동작 코드를 다시 쓰는 비용. 기각.
- ✅ **In-place 하드닝** — 이미 만든 75%를 안전하게 굳히고, 미완성 25%만 마무리한다. **채택.**

이 앱의 복잡함은 "어질러진 복잡함(accidental)"이 아니라 도메인이 원래 이만큼 복잡해서 생긴 **"일하는 복잡함(earned)"** 이다.

---

## 1. 시퀀싱 원칙: 기능 먼저, 보안은 런칭 게이트

대표님 결정: **실사용 중 오작동을 먼저 잡고, 보안(RLS)은 뒤로.**

타당하다 — 단 **한 가지 조건을 못 박는다:**

> 🔒 **보안 게이트 조건:** "나중"의 정의 = **첫 실제 학원이 실데이터(실명·전화·결제)로 온보딩하기 직전.**
> "언젠가"가 아니다. **공개 런칭 = 보안 게이트(P0) 통과**로 묶는다.

근거: 현재 anon 키 하나로 전 학원 매출·연락처·권한 테이블을 직접 R/W 가능(30개 테이블 RLS off). 실유저 0명인 지금은 능동적 위험이 아니나, 실데이터 유입 즉시 개인정보보호법·결제사고 리스크가 현실화된다.
보너스: 아래 정합성 작업(상태값·제약·취소로직)은 RLS 정책 설계의 전제조건이라, 먼저 해도 버려지지 않는다.

---

## 2. 합의된 도메인 규칙 (인터뷰 결과)

### 수강권 상품 모델
- **소진 방식 2종 공존**: 횟수제(만료기간 동반 가능, 예: 10회/30일) · 기간제.
- **적용 범위 2종**: 프리패스(전 수업) · 특정 수업 한정.
- **빈도 제한은 추상 캡이 아니라 '반'의 요일 패턴**으로 구현(예: 월수금 kpop취미반).

### 신청 패러다임 2종
- **세션별 신청(A)**: 프리패스(횟수 차감 없음, 기간 내 무제한) · 횟수권(1회 차감).
- **반 등록형(B)**: 특정 수업권 결제 시 그 반의 기간 내 전 회차 자동 편성. 연장/일시정지로 기간(window) 조정.

### 소비 생명주기
- 횟수 **신청 즉시 1회 차감**.
- 학생 자가취소 마감선 = **수업 전날 자정**.
- 마감선 내 취소 → **횟수 복원** / 마감선 지난 취소·노쇼 → **횟수 소멸**.
- **관리자 재량으로 회복/충전 가능** + 그 내역은 **감사 로그(`enrollment_activity_log`)**에 남긴다.

### 환불·회복 정책 (학원/피트니스 표준 — 기본값, 추후 조정 가능)
- **횟수권 환불액** = 결제액 − (사용 회차 × 할인 전 1회 정가) − 위약금.
- **기간권 환불액** = 결제액 × (잔여일 / 총일) − 위약금. (일할 정산)
- **관리자 회복(충전)** = 사유 기재 필수 + 로그. 원결제 회차 초과 가능(서비스 차원)하되 반드시 기록.

---

## 3. 작업 순서 (런타임 에러 제거 우선)

| 단계 | 내용 | 효과 |
|---|---|---|
| **0. 퀵윈** | ① `createServiceClient` anon silent fallback 제거(키 누락 시 throw). ② 노쇼/결석 상태 도입, ③ 취소 마감 주체(전날 자정 자가취소·이후 관리자만) 확정 | 잠재 500 차단 + 정책 확정 |
| **1. 예약·정원 정합성** | current_students 신뢰 제거(실 bookings 카운트 기준 판정·원자적 증감), `bookings(schedule_id,user_id)` 활성 유니크, drift 8건 백필 | 정원오류·중복/동시신청 제거 |
| **2. 취소→차감/복원→노쇼 생명주기** | 전날 자정 마감 **백엔드 강제**, 복원/소멸 분기, 노쇼/결석 상태, 관리자 회복+로그 | 횟수 분쟁·오복원 제거 |
| **3. 상태값 정규화** | payment_method/payment_status/bookings.status 표준화 + CHECK + 기존 데이터 정정 | 매출집계·대시보드 오표시 제거 |
| **4. 알림 파이프라인 복구** | 스케줄러(Vercel cron/pg_cron)로 `scheduled-reminders` 정기 가동, pending 큐 배수, 멱등, 트리거 정의(만료 D-7/D-3/당일·잔여횟수·수업리마인더) | "기한 알림" 실제 작동 |
| **5. 환불 흐름 신설** | 환불 신청/승인 + Toss 환불 API + 부분환불 계산(위 표준) | 운영자 환불 처리 가능 |
| **6. 보안 게이트 (P0)** | 전 테이블 RLS 정책 + anon/authenticated 직접 grant 회수 + SECURITY DEFINER 노출 차단 | **공개 런칭 전 필수** |
| **7. 위생** | FK 인덱스 43건, 미사용 인덱스 20건, 거대 컴포넌트 분해, 죽은 테이블(`user_bookings`/`user_payments`) 정리 | 성능·유지보수 |

---

## 4. 기능별 완성도 스냅샷 (2026-06-10 실측)

| 기능 | 상태 | 완성도 | 처리 |
|---|---|---|---|
| 수강권 상품 CRUD | ✅ | 95% | 유지 |
| 수강권↔수업 연계 | ✅ | 98% | 유지 |
| 수업 관리 | ✅ | 90% | 보강 |
| 반복배치/반복삭제 | ✅ | 95% | 유지 |
| 수강신청(세션별) | ✅ | 92% | **1·2단계 하드닝** |
| 출석(QR) | ✅ | 85% | 수동 출석 폴백 추가 |
| 연장/일시정지 | ✅ | 95% | 유지 |
| 알림 | 🟡 | 50% | **4단계: 정지→복구** |
| 결제 발급(3경로) | ✅ | 95% | 유지 |
| 환불/조정 | 🟡 | 60% | **5단계: 환불 신설** |
| 게스트/병합 | ✅ | 98% | 유지 |
| 권한/역할 | ✅ | 80% | 강사 권한 보강 + 6단계 RLS |

알림 정밀상태: 엣지함수 `notification-worker`·`scheduled-reminders`는 배포·ACTIVE이나 **pg_cron 미설치 → 스케줄 트리거 없음**, 큐 sent 17/pending 17, 마지막 적재 2026-05-11(약 1개월 정지).

---

## 5. 열린 질문 / 추적 항목

- [ ] 노쇼/결석 상태를 `bookings.status` 확장으로 둘지, 별도 attendance 상태로 둘지 (1·2단계에서 확정)
- [ ] 알림 스케줄러를 Vercel cron으로 할지 pg_cron으로 할지 (4단계)
- [ ] 환불 위약금률 표준값 확정 (5단계 착수 시)
- [ ] RLS 정책의 역할별 가시성 매트릭스 정의 (6단계)
- [ ] 보안 게이트 시 SECURITY DEFINER 함수(consume_ticket_count 등) RPC 실행권한 anon/authenticated 회수 검토 (현재는 user_tickets RLS-off 와 동일 수준 — 게이트에서 일괄 처리)

---

## 8. 실행 완료 로그 (2026-06-10 작업 세션)

> 빌드 검증: `npm run build` 통과(exit 0). DB 정합성: 중복 활성예약 0 / current_students 드리프트 0 / 알림큐 적체 0.

**완료 (#1~#7, #9)**
- **#1 예약·정원 정합성** — `sync_schedule_student_count`(AFTER 트리거, current_students 자동 동기화·드리프트 구조적 불가) + `enforce_schedule_capacity`(BEFORE 트리거, 행잠금 정원초과 차단, `is_admin_added` 예외) + 부분 유니크 인덱스 2개(회원/게스트) + 백필(중복8·드리프트8 정정). 5개 예약경로의 수동 카운트 조작 전부 제거.
- **RACE-2 횟수 이중차감** — `consume_ticket_count` RPC(원자적 조건부 차감)로 `consumeUserTicket` 교체.
- **#2 복원 멱등성** — `oldStatus!=='CANCELLED'` 가드(이중 복원 차단). (authz는 보안게이트로 이관)
- **#3 노쇼/결석** — ABSENT 이미 구현 확인. 전날자정 마감은 학생 self-cancel 부재로 N/A.
- **#4 상태값** — 매출은 revenue_transactions(클린) 사용 확인 → 라이브버그 아님. payment_method `card→CARD` 정규화.
- **#5 계좌이체 멱등** — PENDING→CONFIRMED 원자적 claim + 실패 시 되돌림. 카드/계좌 결제후 예약 insert 에러 포착.
- **#6 타임존** — `combineDateAndTime` KST 결정적 수정, 푸시 시각문자열 formatKST, 기간권 윈도우/날짜 KST 경계. `scheduled-reminders` 엣지함수 수업시각 9h 버그 수정 후 v3 재배포.
- **#7 알림 파이프라인** — pg_cron+pg_net 활성화. 큐배수(5분)+리마인더생성(15분) 스케줄. pending 17→0 즉시 배수 검증. ⚠ 푸시 실배송은 엣지함수 FIREBASE_* env 필요(미설정 시 인앱만 — 확인 요).
- **#9 위생** — FK 인덱스 40개, 방치주문 정리 함수+일일 cron(유니크 슬롯 해제 포함).

**미완료 (#8 환불 — 의도적 보류)**
- 환불은 신규 기능(현재 미존재)이며 Toss 결제취소 API 연동 + 부분환불 계산 + 승인흐름이 필요. 실제 환불 API는 테스트 없이 배포 위험이 커, "오작동 수정" 범위와 분리하여 **테스트 가능한 별도 세션**에서 진행 권장. 현재는 관리자 수동 횟수조정(`adjust-ticket-count`)으로 부분 대응 가능.

**남은 권장 (별도)**
- 보안 게이트(#6 원안: RLS + anon grant 회수) — 첫 실유저 온보딩 전 필수.
- 클라이언트 스케줄 생성(modal)의 브라우저 TZ 의존 제거(비-KST 관리자 대비) — 현재 KST 관리자 한정 정상.
- 거대 컴포넌트 분해(2,200줄 예약 페이지 등).

---

## 6. 전수조사 결과 (2026-06-10) — 확정 결함 목록

> 코드 정밀감사 2건 + DB 불변식 검사 교차 검증. "데이터확인" = 실제 운영 데이터에서 그 결함의 증거가 나온 항목.

### DB 불변식 스냅샷
| 지표 | 값 | 의미 |
|---|---|---|
| 중복 활성 예약 `(schedule,user)` | **8** | 동시신청 레이스 실제 발생(데이터확인) |
| current_students 불일치 | **8** (최악: 저장 2 / 실제 6) | 카운터 read-modify-write 손실(데이터확인) |
| 과거 스케줄인데 열린 예약 | **55** | 출석/노쇼 마감 자동화 부재 → 예약이 영원히 CONFIRMED |
| revenue 행에 user_ticket 없음 | 26 | 발급-매출 연결 점검 필요 |
| PENDING 결제주문 >3일 방치 | 62 | 장바구니 잔재, 정리 루틴 없음 |
| PENDING 계좌이체주문 >14일 | 27 | 〃 |
| 만료인데 ACTIVE / 0회인데 ACTIVE / 시작>만료 / 잘못된 시간범위 | 0 | ✅ expire-tickets cron 정상 작동 중 |

타임존: 저장된 start_time은 KST 오후~저녁대로 정상(클라이언트 입력 경로). **서버측 세션 생성 경로(`combineDateAndTime`)만 9h 어긋남 — 잠재(미발현).**

### 결함 우선순위 (런타임 오작동 직결)

**CRITICAL**
- **RACE-1 정원 카운터 레이스** — 5개 예약 경로 전부 `SELECT current_students → JS검사 → +1 UPDATE`. 동시 마지막자리 → 초과예약. DB 제약·트랜잭션·원자증감 전무. (데이터확인: drift 8, dup 8)
  `bookings/route.ts`, `bookings/guest/route.ts:91,163`, `admin-add/route.ts:97-108`, `admin-add-guest/route.ts:81,116`, `lib/db/period-ticket-bookings.ts:164-172,308-321`
- **RACE-2 횟수 차감 레이스** — `consumeUserTicket`(`lib/db/user-tickets.ts:345-371`) 비원자 감산. 더블클릭/웹훅+클라 동시 → 1회권으로 2예약, 1회만 차감.
- **RESTORE 복원 멱등성 없음** — 취소 시 횟수 복원에 `oldStatus !== 'CANCELLED'` 가드 없음(`bookings/[id]/status/route.ts:120-159`). 이미 취소된 예약 재PATCH → 횟수 무한 증가(운영자 더블클릭으로 발생).
- **AUTHZ 상태변경 권한검증 없음** — `bookings/[id]/status/route.ts`가 소유자/관리자 확인 없이 booking id만으로 상태변경. 아무 로그인 사용자가 타인 예약 취소·횟수 인플레 가능. (RESTORE와 결합 시 악용)
- **TZ-1 서버 세션생성 9h 시프트(잠재)** — `lib/utils/schedule-generator.ts:75-80` `combineDateAndTime`가 UTC 런타임에서 `setHours().toISOString()`. 클라 생성은 정상, 서버 재생성은 9h 빠름. split-brain.
- **TZ-2 반복 날짜 생성 off-by-one** — `generateSessionDates`가 `new Date('YYYY-MM-DD')`(UTC자정)+`getDay()`. `formatDateToYMD` 로컬게터 왕복 시 KST 자정 근처 전날로 밀려 요일 전체가 어긋날 위험.

**HIGH**
- **IDEMP-bank 계좌이체 발급 비멱등** — `bank-transfer-confirm`이 PENDING→CONFIRMED를 끝에서 처리(원자 claim 없음). 토스는 `toss_order_id` 유니크로 보호되나 계좌이체엔 그 백스톱 없음. 관리자 더블클릭 → user_ticket·revenue 이중 발급.
- **PARTIAL 결제후 예약insert 미검증** — `payment-confirm/route.ts:483-499` 차감 후 booking insert 에러 미확인. 실패 시 결제·차감 완료인데 좌석 없음.
- **DEADLINE 취소 마감 부재** — 현재 수업 시작 직전까지 취소+복원 가능(전날 자정 규칙 없음). 직전 취소로 횟수 회수 = 오복원.
- **NOTIF 파이프라인 미가동** — repo에 리마인더 cron/producer 없음(vercel.json crons = auto-charge, expire-tickets 뿐). 워커는 배포돼 있으나 정기 호출 없음 → pending 17 적체, 푸시 소멸. 리마인더 자체가 생성 안 됨.
- **NOTIF 이중쓰기** — `send-notification`이 notifications+notification_queue를 트랜잭션·멱등키 없이 기록 → 부분실패/중복발송.
- **PAUSE 재편성 부정확** — 일시정지 후 "빠진 회차"가 아니라 "달력 꼬리구간"을 재예약. 과거구간 정지 가드 없음. 기간권 자동예약도 비원자.
- **TZ-3 사용자대상 시각문자열 9h** — 취소/노쇼 푸시(`status/route.ts:223,320`)가 `getHours()` 로컬 → 18:00 수업이 "9:00"으로 표기.

**MEDIUM**
- `.single()` PGRST116 미처리 다수 → 정상 데이터 상태에서 500.
- 상태값 분열: `payment_status` PAID vs COMPLETED 혼용 → 집계 누락.
- 과거 열린 예약 55건 자동마감 부재(출석/노쇼 전이 없음).
- `getSchedulesForPeriodTicket` 윈도우 naive TZ → 첫날 이른시간 수업 누락 ±9h.
- 누적 일시정지/연장 상한 없음(무한 연장 가능). 관리자 경로는 max_extension 미검증.
- 방치 주문(62/27) 정리 루틴 없음.

### 잘 되어 있는 것 (유지)
- 토스 카드결제 멱등성(toss_order_id 유니크 + 23505 처리)은 견고.
- 금액검증 견고: 서버 재계산 + order.amount 재확인 + 토스 재확인. 클라 조작 불가.
- PERIOD/프리패스는 차감/복원에서 올바르게 제외됨(레이스는 COUNT권 한정).
- expire-tickets cron 정상(만료 불변식 0건).

---

## 7. 1단계 상세 설계 — 예약·정원 정합성

**목표:** current_students를 신뢰 가능하게, 중복·동시 신청을 DB가 차단, 기존 오염 정정.

### 7.1 원자적 예약 RPC (핵심)
모든 예약 경로의 `SELECT→검사→+1 UPDATE`를 **단일 Postgres 함수**로 대체. 스케줄 행을 `FOR UPDATE`로 잠가 동시성을 직렬화한다.

```
create function create_booking_atomic(p_schedule_id uuid, p_user_id uuid, p_user_ticket_id uuid, p_guest ...)
-- 1) select ... from schedules where id=p_schedule_id for update  (행 잠금)
-- 2) is_canceled / start_time>now 검증
-- 3) actual := count(bookings where schedule_id=p_schedule_id and status in ('CONFIRMED','PENDING','COMPLETED'))
-- 4) if actual >= coalesce(max_students, 기본값) → raise 'FULL'
-- 5) 중복: exists(같은 user_id/ guest_phone 활성 예약) → raise 'DUP'
-- 6) insert booking
-- 7) update schedules set current_students = actual+1   (캐시값을 진실로 동기화)
-- return booking row
```
- 카운터는 더 이상 진실원이 아니라 **잠금 구간에서 실제 count로 재설정되는 캐시**가 됨 → drift 구조적 불가.
- 횟수 차감(RACE-2)도 같은 함수 안에서 `update user_tickets set remaining_count = remaining_count - 1 where id=? and status='ACTIVE' and remaining_count >= 1`(0행이면 raise)로 원자 처리.

### 7.2 유니크 제약 (DB 백스톱)
```
-- 회원 활성 예약 중복 차단
create unique index uniq_booking_member_active on bookings(schedule_id, user_id)
  where status in ('CONFIRMED','PENDING','COMPLETED') and user_id is not null;
-- 게스트 활성 예약 중복 차단
create unique index uniq_booking_guest_active on bookings(schedule_id, guest_phone)
  where status in ('CONFIRMED','PENDING','COMPLETED') and user_id is null;
```
코드는 23505를 "이미 예약됨"으로 처리.

### 7.3 데이터 백필 (제약 추가 前 필수)
1. 중복 활성 예약 8건: 각 `(schedule,user)`에서 created_at 최소 1건 유지, 나머지는 `CANCELLED`로(횟수 복원 없이) 정리. 8건 개별 확인 후 실행.
2. 전 스케줄 current_students = 실제 활성 예약 count로 재계산(drift 8건 정정).

### 7.4 코드 이전
5개 경로(`bookings/route.ts`, `guest`, `admin-add`, `admin-add-guest`, `period-ticket-bookings.ts`)의 정원/차감 로직을 RPC 호출로 교체, JS 정원 게이트 제거.

### 7.5 경계 항목 (2단계로 인계)
- 과거 열린 예약 55건 자동마감(→ 출석 COMPLETED / 미출석 NOSHOW)은 노쇼 상태 도입과 함께 2단계.
- 취소 마감(전날 자정) 백엔드 강제도 2단계.

### 완료 기준
- 동시 예약 부하에서 초과예약 0, current_students drift 0 유지.
- 중복 예약 insert가 DB에서 거부됨.
- 기존 drift/중복 8+8건 정정 완료.
