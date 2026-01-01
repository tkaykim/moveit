# NULL 제약 제거 마이그레이션 가이드

## 중요 안내

**`currentDB.sql` 파일은 실행하지 마세요!**
- 이 파일은 참고용 스키마입니다
- 실행하면 "relation already exists" 오류가 발생합니다

## 마이그레이션 실행 방법

### 방법 1: 안전한 스크립트 (권장)

1. **Supabase Dashboard에 로그인**
2. **SQL Editor로 이동**
3. **`migrations/allow_null_for_all_columns.sql` 파일의 내용을 복사**
4. **SQL Editor에 붙여넣고 실행**
   - 이 스크립트는 컬럼이 존재하고 NOT NULL인 경우에만 ALTER를 실행합니다
   - 오류 없이 안전하게 실행됩니다

### 방법 2: 간단한 스크립트

1. **`migrations/simple_allow_null.sql` 파일의 내용을 복사**
2. **SQL Editor에 붙여넣고 실행**
   - 더 간단하지만, 존재하지 않는 컬럼에 대한 오류 메시지를 무시하세요
   - 이미 NULL을 허용하는 컬럼에 대한 오류는 무시해도 됩니다

### 방법 3: 먼저 확인하기

1. **`migrations/check_not_null_columns.sql` 파일을 실행**
2. **결과를 확인하여 실제로 NOT NULL 제약이 있는 컬럼만 확인**
3. **그에 맞게 필요한 ALTER TABLE 문만 실행**

## 실행할 SQL 스크립트

### 권장: `migrations/allow_null_for_all_columns.sql`

이 스크립트는:
- 모든 테이블의 NOT NULL 제약을 제거합니다 (PRIMARY KEY 제외)
- 이미 NULL을 허용하는 컬럼에 대해 실행해도 오류가 발생하지 않습니다
- `ALTER TABLE IF EXISTS`를 사용하여 테이블이 없어도 오류가 발생하지 않습니다

## 변경 사항

다음 컬럼들이 NULL 값을 허용하도록 변경됩니다:

- `academies`: `owner_id`, `name`
- `branches`: `academy_id`, `name`, `address_primary`
- `classes`: `academy_id`, `title`, `class_type`
- `halls`: `branch_id`, `name`
- `schedules`: `class_id`, `branch_id`, `hall_id`, `instructor_id`, `start_time`, `end_time`, `max_students`
- `tickets`: `academy_id`, `name`, `ticket_type`, `price`
- `user_tickets`: `user_id`, `ticket_id`
- `users`: `email`, `name`
- `instructors`: `stage_name`

## 주의사항

- 기존 데이터는 영향을 받지 않습니다
- NULL을 허용하더라도 애플리케이션 로직에서 적절한 기본값을 제공하는 것이 좋습니다
- 프로덕션 환경에서는 마이그레이션 전 백업을 권장합니다

