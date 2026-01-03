# Classes와 Schedules 테이블 분석 및 통합 방안

## 현재 구조 분석

### Classes 테이블
- **목적**: 클래스의 기본 정보 (템플릿/설정)
- **필드**: title, genre, difficulty_level, class_type, price, description, thumbnail_url
- **문제가 되는 필드**: instructor_id, hall_id, max_students, current_students, status

### Schedules 테이블
- **목적**: 실제 수업 시간표 (인스턴스)
- **필드**: start_time, end_time, instructor_id, hall_id, max_students, current_students, is_canceled
- **관계**: class_id로 classes를 참조

## 분리된 이유 (정당한 이유)

1. **하나의 클래스가 여러 시간대에 반복될 수 있음**
   - 예: "K-POP 정규반"이 매주 월요일 7시, 수요일 8시에 진행
   - 하나의 클래스 정의로 여러 스케줄 생성 가능

2. **스케줄마다 강사/홀이 다를 수 있음**
   - 같은 클래스라도 월요일은 A강사, 수요일은 B강사
   - 같은 클래스라도 홀 A 또는 홀 B 사용 가능

3. **스케줄별 인원 관리**
   - 각 스케줄마다 최대 인원과 현재 인원이 다를 수 있음

## 문제점

1. **중복 필드**
   - `instructor_id`, `hall_id`, `max_students`, `current_students`가 두 테이블에 모두 존재
   - 실제로는 schedules에서만 사용됨

2. **혼란스러운 구조**
   - classes에 있는 필드들이 실제로는 schedules에서 관리됨
   - 개발자가 어디를 수정해야 할지 헷갈릴 수 있음

3. **데이터 불일치 가능성**
   - classes의 instructor_id와 schedules의 instructor_id가 다를 수 있음
   - 어떤 것이 실제 값인지 불명확

## 통합 방안

### 방안 1: Classes를 순수 템플릿으로 정리 (권장)

**변경사항:**
- classes에서 제거할 필드: `instructor_id`, `hall_id`, `max_students`, `current_students`, `status`
- classes는 순수하게 클래스 정보만 저장: title, genre, difficulty_level, class_type, price, description, thumbnail_url
- 모든 실제 운영 정보는 schedules에서 관리

**장점:**
- 역할이 명확해짐 (classes = 템플릿, schedules = 실제 수업)
- 중복 제거
- 데이터 일관성 보장

**단점:**
- 마이그레이션 필요
- 기존 코드 수정 필요

### 방안 2: 완전 통합 (비권장)

**변경사항:**
- schedules에 모든 정보 통합
- classes 테이블 제거

**단점:**
- 반복되는 클래스 정보가 중복 저장됨 (title, genre 등)
- 데이터 정규화 위반
- 스토리지 낭비

## 권장 사항

**방안 1을 권장합니다.** 

이유:
1. 분리 자체는 정당한 이유가 있음 (하나의 클래스가 여러 스케줄을 가질 수 있음)
2. 하지만 classes의 불필요한 필드들을 제거하여 역할을 명확히 할 수 있음
3. 마이그레이션 비용이 적음 (필드 제거만 하면 됨)

