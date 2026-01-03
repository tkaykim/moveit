# Schedules를 Classes로 통합 완료

## 변경 사항 요약

### 데이터베이스 마이그레이션
✅ **완료**
- `classes` 테이블에 일정 정보 필드 추가:
  - `start_time` (timestamp with time zone)
  - `end_time` (timestamp with time zone)
  - `is_canceled` (boolean)
  - `instructor_id`, `hall_id`, `max_students`, `current_students`, `status` 복구

- `schedules` 테이블 제거
- 관련 테이블의 `schedule_id`를 `class_id`로 변경:
  - `bookings` 테이블
  - `daily_logs` 테이블
  - `instructor_salaries` 테이블

### 코드 변경
✅ **완료**

#### 수정된 파일:
1. `app/academy-admin/components/views/classes-view.tsx`
   - `schedules` 조회 → `classes` 조회로 변경
   - `getSchedulesForDay` → `getClassesForDay`로 변경
   - 모든 schedule 참조를 class로 변경

2. `app/academy-admin/components/views/classes/class-modal.tsx`
   - 일정 정보 필드 추가 (start_time, end_time, instructor_id, hall_id, max_students)
   - 강사, 홀 선택 기능 추가

3. `app/academy-admin/components/views/daily-log-view.tsx`
   - `schedules` → `classes`로 변경
   - `schedule_id` → `class_id`로 변경

4. `app/academy-admin/components/views/logs/daily-log-modal.tsx`
   - `schedule` → `classItem`으로 변경
   - `schedule_id` → `class_id`로 변경

5. `app/academy-admin/components/views/dashboard-view.tsx`
   - 오늘 예정 수업 조회를 `classes`에서 직접 조회하도록 변경

6. `app/academy-admin/components/views/instructor-view.tsx`
   - `schedules` 참조 제거, `classes`에서 직접 조회

#### 삭제된 파일:
- `app/academy-admin/components/views/classes/schedule-modal.tsx` (더 이상 필요 없음)

## 새로운 구조

### Classes 테이블 (통합 완료)
이제 `classes` 테이블 하나로 모든 정보를 관리:
- **클래스 정보**: title, genre, difficulty_level, class_type, price, description
- **일정 정보**: start_time, end_time, is_canceled
- **운영 정보**: instructor_id, hall_id, max_students, current_students, status
- **학원 정보**: academy_id

### 장점
1. **단순화**: 테이블이 하나로 통합되어 구조가 명확해짐
2. **직관적**: 하나의 클래스 = 하나의 수업 인스턴스
3. **유지보수 용이**: 중복 제거로 데이터 일관성 보장

### 사용 방법
- 클래스 생성 시 모든 정보(일정, 강사, 홀, 인원 등)를 한 번에 입력
- 같은 클래스가 여러 시간대에 필요하면 각각 별도의 클래스 레코드로 생성


