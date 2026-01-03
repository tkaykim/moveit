# Classes와 Schedules 테이블 리팩토링 요약

## 분석 결과

### 분리된 이유 (정당함)
1. **하나의 클래스가 여러 시간대에 반복될 수 있음**
   - 예: "K-POP 정규반"이 매주 월요일 7시, 수요일 8시에 진행
   - 하나의 클래스 정의로 여러 스케줄 생성 가능

2. **스케줄마다 강사/홀이 다를 수 있음**
   - 같은 클래스라도 월요일은 A강사, 수요일은 B강사
   - 같은 클래스라도 홀 A 또는 홀 B 사용 가능

3. **스케줄별 인원 관리**
   - 각 스케줄마다 최대 인원과 현재 인원이 다를 수 있음

### 문제점
- **중복 필드**: `instructor_id`, `hall_id`, `max_students`, `current_students`, `status`가 두 테이블에 모두 존재
- **혼란스러운 구조**: classes에 있는 필드들이 실제로는 schedules에서만 사용됨
- **데이터 불일치 가능성**: classes의 값과 schedules의 값이 다를 수 있음

## 적용한 해결책

### Classes 테이블 정리
**제거한 필드:**
- `instructor_id` → schedules에서만 관리
- `hall_id` → schedules에서만 관리
- `max_students` → schedules에서만 관리
- `current_students` → schedules에서만 관리
- `status` → schedules의 `is_canceled`로 대체

**남은 필드 (순수 클래스 정보):**
- `title` - 클래스명
- `genre` - 장르
- `difficulty_level` - 난이도
- `class_type` - 클래스 유형 (regular, popup, workshop 등)
- `price` - 기본 가격
- `song` - 곡명
- `description` - 설명
- `thumbnail_url` - 썸네일

### 역할 명확화
- **Classes**: 클래스 템플릿/설정 정보 (무엇을 가르치는가)
- **Schedules**: 실제 수업 시간표 (언제, 어디서, 누가 가르치는가)

## 변경 사항

### 데이터베이스
✅ 마이그레이션 적용 완료
- `classes` 테이블에서 불필요한 필드 제거
- Foreign key 제약조건 제거

### 코드
✅ 수정 완료
- `class-modal.tsx`: instructor_id, hall_id, max_students 필드 제거
- 클래스 생성 시 강사/홀/인원은 스케줄에서 설정하도록 안내 메시지 추가

## 사용 가이드

### 클래스 생성
1. **클래스 정보 입력** (제목, 장르, 난이도, 가격 등)
2. **저장**
3. **스케줄 추가**에서 실제 수업 시간, 강사, 홀, 인원 설정

### 스케줄 생성
- 클래스를 선택한 후
- 시간, 강사, 홀, 최대 인원을 설정
- 각 스케줄마다 독립적으로 관리됨

## 장점

1. **역할 명확화**: classes는 템플릿, schedules는 실제 수업
2. **중복 제거**: 불필요한 필드 제거로 데이터 일관성 보장
3. **유연성**: 같은 클래스로 여러 스케줄 생성 가능 (다른 강사, 홀, 시간)
4. **명확성**: 개발자가 어디를 수정해야 할지 명확함

