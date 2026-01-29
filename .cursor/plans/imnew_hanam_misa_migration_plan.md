# 아임뉴댄스 하남미사점 Supabase 마이그레이션 계획

## 1. 개요

- **학원명**: 아임뉴댄스 하남미사점 (IMNEW HANAM MISA)
- **주소**: 경기도 하남시 미사강변동로 84번길 21, 남송타워 5층
- **태그**: 취미댄스, 케이팝댄스, 초보반, 키즈댄스
- **현재 DB**: 해당 학원 없음 → 신규 INSERT 필요

첨부 자료 기준으로 **스케줄(취미반 주간 / 심화반 2026년 1월)**과 **가격 구성(취미반·심화반·트레이닝반)**을 Supabase 스키마에 맞춰 마이그레이션한다.

---

## 2. DB 스키마 매핑 요약

| 자료 | DB 테이블 | 비고 |
|------|-----------|------|
| 학원 정보 | `academies` | name_kr, name_en, address, tags |
| 수업 종류(템플릿) | `classes` | title, genre, difficulty_level, class_type, access_config |
| 반복 요일/시간 | `recurring_schedules` | days_of_week, start_time, end_time, start_date, end_date |
| 실제 일시별 수업 | `schedules` | recurring_schedules 기반 생성 또는 직접 INSERT |
| 강사 | `instructors` + `academy_instructors` | 심화반 강사명 등 |
| 수강권/쿠폰 | `tickets` | ticket_type COUNT/PERIOD, is_coupon, access_group |
| 수강권-수업 연결 | `ticket_classes` | 어떤 수강권으로 어떤 클래스 수강 가능한지 |
| 할인 | `discounts` | 성인취미반 3개월 7만원 할인 등 |
| 강의실 | `halls` | 학원당 최소 1개 권장 |

---

## 3. 마이그레이션 단계

### Phase 1: 학원 및 기본 시설

1. **academies**
   - `name_kr`: 아임뉴댄스 하남미사점
   - `name_en`: IMNEW HANAM MISA
   - `address`: 경기도 하남시 미사강변동로 84번길 21, 남송타워 5층
   - `tags`: `취미댄스,케이팝댄스,초보반,키즈댄스` (기존 academies.tags 형식에 맞춤)
   - `is_active`: true

2. **halls**
   - 해당 학원에 강의실 1개 이상 (예: "메인 스튜디오")  
   - 이후 `classes`, `recurring_schedules`, `schedules`의 `hall_id`로 사용

---

### Phase 2: 취미반 주간 스케줄 (classes + recurring_schedules → schedules)

취미반은 **요일+시간 고정**이므로 `classes`(수업 템플릿) + `recurring_schedules`(요일/시간)로 넣고, 기존 로직으로 `schedules` 생성.

| 수업명 | 요일 | 시간 | 비고 |
|--------|------|------|------|
| 오전반 기초댄스 | 화, 목 | 12:00–13:00 | |
| 주말 키즈댄스 | 토 | 13:00–14:00 | |
| 주말반 K-POP댄스 | 토 | 14:00–16:00 | |
| 월수 키즈댄스 | 월, 수 | 18:00–19:00 | |
| 화목 키즈댄스 | 화, 목 | 18:00–19:00 | |
| 금요일 키즈중급반 | 금 | 18:00–19:30 | |
| 취미 K-POP | 월, 수 | 19:00–20:00 | |
| 직장인 K-POP | 화, 목 | 19:00–20:00 | |
| 기초 걸스힙합 | 월, 수 | 20:30–21:30 | |
| 뚝딱이 댄스기초 | 화, 목 | 20:30–21:30 | |

- **classes**: 위 각 행마다 1개 class (academy_id, hall_id, title, genre, difficulty_level, class_type='regular', access_config.requiredGroup = null 또는 'general')
- **recurring_schedules**:  
  - `days_of_week`: JS 기준 0=일…6=토 → 월=1, 화=2, 수=3, 목=4, 금=5, 토=6  
  - `start_time` / `end_time`: time only (예: `12:00`, `13:00`)  
  - `start_date` / `end_date`: 적용 기간 (예: 2026-01-01 ~ 2026-12-31)  
  - `class_id`, `academy_id`, `hall_id`, `instructor_id`(없으면 null)
- **schedules**: `generateSessionsFromRecurringSchedule` 등 기존 함수로 `recurring_schedules` 기준 생성 (또는 동일 로직으로 SQL/스크립트 생성)

---

### Phase 3: 심화반 (2026년 1월)

심화반은 **날짜별로 강사/장르가 다름**. 선택지:

- **A안**: 요일·시간대별로 `classes` 여러 개 만들고, `recurring_schedules`로 1월만 반복 생성한 뒤, 각 `schedules` 행의 `instructor_id`를 날짜별로 UPDATE.
- **B안**: 1월 스케줄만 필요하면, `classes`를 장르/시간대 단위로 만들고, 1월 각 날짜에 대해 `schedules`를 직접 INSERT (recurring_schedule_id 없음).

권장: **A안**으로 재사용 가능한 반복 규칙을 두고, 강사만 스케줄별로 업데이트.

심화반 예시 (이미지 기준):

- 월 7:00–8:20 CHOREO/GIRLS (DOOAH 등)
- 화 7:00–8:20 HOUSE/CHOREO (CHOROC), 8:20–9:40 WAACKING (HAPPYCATT) / CHOREO/GIRLS (SOLAR)
- 수 7:00–8:20 HIPHOP (SPARROW), 8:20–9:40 CHOREOGRAPHY (CHESMEE / CHEMI)
- 목 7:00–8:20 CHOREO/GIRLS (KKALIN), 8:20–9:40 CHOREOGRAPHY (CHAECHAE)
- 금 7:30–8:50 실용무용입시반 (DOOAH)

필요 데이터:

- **instructors**: DOOAH, CHOROC, HAPPYCATT, SPARROW, CHESMEE, KKALIN, CHAECHAE, SOLAR, HINARI, CHEMI 등 (name_kr/name_en)
- **academy_instructors**: 위 강사–하남미사 학원 연결
- **classes**: 심화반용 클래스 (genre, difficulty_level, access_config.requiredGroup = 'advanced' 또는 동일 그룹명)
- **recurring_schedules** 또는 **schedules** 직접: 2026-01-01 ~ 2026-01-31, 요일/시간 맞춤
- **schedules.instructor_id**: 날짜별 강사 매핑

---

### Phase 4: 가격 구성 (tickets + ticket_classes)

#### 4.1 취미반 (Hobby/K-POP/Kids)

| 상품명 | 타입 | 가격 | DB 매핑 |
|--------|------|------|---------|
| 1회 쿠폰 | 쿠폰 1회 | 25,000 | is_coupon=true, ticket_type=COUNT, total_count=1, price=25000, access_group='general' |
| 1개월 수강 (주2회 60분) | 기간권 | 150,000 | ticket_type=PERIOD, valid_days=30, price=150000 |
| 1개월 수강 (주4회 60분) | 기간권 | 280,000 | ticket_type=PERIOD, valid_days=30, price=280000 |
| 3개월 수강 (주2회) | 기간권 | 400,000 | ticket_type=PERIOD, valid_days=90, price=400000 |
| 3개월 수강 (주4회) | 기간권 | 450,000 | ticket_type=PERIOD, valid_days=90, price=450000 |
| 프리패스 (1개월) | 기간권 | 300,000/월 | ticket_type=PERIOD, valid_days=30, price=300000 |

- `academy_id`: 하남미사 학원 ID  
- `ticket_category`: 'regular'  
- `is_public` / `is_on_sale`: 노출·판매 여부에 맞게 설정  
- **ticket_classes**: 위 취미반 수강권 각각에 대해, 취미반 `classes` 전부(또는 해당 그룹)를 연결

#### 4.2 심화반 (Choreography/Street Dance)

| 상품명 | 타입 | 가격 | DB 매핑 |
|--------|------|------|---------|
| 1회 쿠폰 | 쿠폰 1회 | 30,000 | is_coupon=true, COUNT, total_count=1, price=30000, access_group='advanced' |
| 5회 쿠폰 | 쿠폰 5회 | 140,000 | is_coupon=true, COUNT, total_count=5, price=140000 |
| 3개월 수강 (주1회 80분) | 기간권 | 320,000 | PERIOD, valid_days=90, price=320000 |

- `access_group`: 'advanced' 등으로 통일하고, 심화반 `classes`의 `access_config.requiredGroup`과 맞춤  
- **ticket_classes**: 심화반 클래스들만 연결

#### 4.3 트레이닝반(전문반)

| 상품명 | 타입 | 가격 | DB 매핑 |
|--------|------|------|---------|
| 1 Month | 기간권 | 400,000 | PERIOD, valid_days=30, price=400000, access_group='training' |

- **ticket_classes**: 실용무용입시반 등 트레이닝반 클래스만 연결

---

### Phase 5: 할인 (discounts)

- **성인취미반 3개월 할인**: 정가 400,000 → 330,000 (70,000원 할인)
  - `discounts`: academy_id, name='성인취미반 3개월 할인', discount_type='FIXED', discount_value=70000, is_active=true, valid_from/valid_until(이벤트 기간)
  - 실제 판매 시 어떤 수강권에 적용할지는 앱/결제 로직에서 `ticket_id` + `discount_id`로 처리

---

## 4. 실행 순서 (Supabase MCP 활용 시)

1. **academies** INSERT → 반환된 `id` 저장  
2. **halls** INSERT (academy_id 사용)  
3. **instructors** INSERT (심화반 강사들) → **academy_instructors** INSERT  
4. **classes** INSERT (취미반 10개 + 심화반·트레이닝반 필요한 만큼), hall_id/academy_id 사용  
5. **recurring_schedules** INSERT (취미반 10개, 필요 시 심화반), class_id/academy_id/hall_id/instructor_id  
6. **schedules** 생성: 기존 `generateSessionsFromRecurringSchedule` 호출 또는 동일 로직으로 기간 내 세션 일괄 생성  
7. (심화반) 생성된 `schedules` 중 날짜별로 **instructor_id** UPDATE  
8. **tickets** INSERT (취미반 6종 + 심화반 3 + 트레이닝반 1)  
9. **ticket_classes** INSERT: ticket_id–class_id 쌍 (취미반 수강권–취미반 클래스, 심화반 수강권–심화반 클래스 등)  
10. **discounts** INSERT (성인취미반 3개월 7만원 할인)

---

## 5. 주의사항

- **days_of_week**: JavaScript `Date.getDay()`와 동일 (0=일요일 … 6=토요일). DB는 integer[].
- **recurring_schedules**: `start_time`/`end_time`은 time 타입 (HH:mm). `schedules`는 `start_time`/`end_time`이 timestamptz이므로, `combineDateAndTime(date, time)` 형태로 생성.
- **access_group** vs **classes.access_config.requiredGroup**: 수강권의 `access_group`과 수업의 `requiredGroup`을 맞추면, 해당 수강권으로만 해당 수업 예약 가능하도록 앱에서 사용 가능.
- 기존 프로젝트에 **스케줄 생성 함수**(`generateSessionsFromRecurringSchedule`)가 있으므로, 마이그레이션 스크립트에서 같은 규칙으로 `schedules`를 채우거나, Admin UI에서 “반복 일정 생성”을 실행해도 됨.

---

## 6. 생성된 ID (Phase 1 실행 후)

- **academy_id**: `dc87f10c-fe78-4c71-b158-b5b963ac7e58`
- **hall_id**: `9f1b4a5b-0321-405e-bf62-9f1ae7159b3a` (메인 스튜디오)

이 ID를 Phase 2~6의 classes, recurring_schedules, tickets, discounts 등에서 academy_id / hall_id 로 사용하면 된다.

---

## 7. 적용 완료 내역 (Supabase MCP 실행)

- **Phase 1**: 학원·홀 INSERT 완료.
- **Phase 2~3**: 강사 10명, academy_instructors, 취미반 classes 10개, 심화반/입시반 classes 9개 INSERT 완료.
- **취미반 recurring_schedules** 10개 INSERT (2026-01-01 ~ 2026-01-31).
- **2026년 1월 schedules**:
  - 취미반: recurring_schedules 기준으로 75개 세션 자동 생성 (오전반 기초댄스, 주말 키즈/K-POP, 월수/화목 키즈, 금 키즈중급, 취미/직장인 K-POP, 걸스힙합, 뚝딱이 댄스기초).
  - 심화반·입시반: 날짜·강사별 34개 세션 직접 INSERT (월 CHOREO/GIRLS·CHOREOGRAPHY, 화 HOUSE/CHOREO·2타임, 수 HIPHOP·CHOREOGRAPHY, 목 CHOREO/GIRLS·CHOREOGRAPHY, 금 실용무용입시반 — DOOAH, CHOROC, HAPPYCATT, SPARROW, CHESMEE, KKALIN, CHAECHAE, SOLAR, HINARI, CHEMI 매핑).
- **총 스케줄 수**: 109개 (2026년 1월 기준).

---

## 8. 다음 단계

- Supabase MCP `apply_migration`은 DDL용이므로, **데이터 삽입**은 `execute_sql`로 INSERT 하거나, 로컬에서 Node/TS 스크립트로 Supabase 클라이언트를 사용해 순서대로 실행하는 것을 권장.
- **Phase 4**: tickets(수강권/쿠폰), ticket_classes, discounts 적용 완료.
  - **tickets** 10종: 취미반 6종(1회 쿠폰 25,000 / 1개월 주2회 150,000, 주4회 280,000 / 3개월 주2회 400,000, 주4회 450,000 / 프리패스 300,000), 심화반 3종(1회 30,000 / 5회 140,000 / 3개월 320,000), 트레이닝반 1종(1개월 400,000).
  - **ticket_classes** 85건: 취미반 수강권 6개 × 취미반 클래스 10개, 심화반 수강권 3개 × 심화반 클래스 8개, 트레이닝반 수강권 1개 × 실용무용입시반 1개.
  - **discounts** 1건: 성인취미반 3개월 7만원 할인 (FIXED 70,000).
- Phase 1 ~ Phase 4 모두 Supabase MCP로 적용 완료.
