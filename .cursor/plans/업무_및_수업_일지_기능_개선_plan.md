# 업무 및 수업 일지 기능 개선 계획

## 문제 분석

현재 일지 기능에서 다음과 같은 문제가 발생합니다:

1. **잘못된 테이블 조회**: `daily-log-view.tsx`에서 `classes` 테이블의 `start_time`을 기준으로 조회하고 있지만, `classes` 테이블에는 `start_time` 필드가 없습니다. 실제로는 `schedules` 테이블을 조회해야 합니다.

2. **일지 매칭 문제**: 일지와 수업을 `class_id`로만 매칭하고 있어, 같은 클래스에 여러 스케줄이 있을 때 올바르게 매칭되지 않습니다. `class_id`와 `log_date`를 조합하여 매칭해야 합니다.

3. **날짜 처리 문제**: `daily-log-modal.tsx`에서 항상 오늘 날짜(`today`)를 사용하고 있어, 선택한 날짜의 일지를 작성할 수 없습니다.

4. **데이터 표시 문제**: 일지 상세에서 `item.present_students` 등을 사용하고 있지만, 일지에서 가져온 데이터를 우선적으로 표시해야 합니다.

## 수정 방안

### 1. daily-log-view.tsx 수정

- `schedules` 테이블을 조회하도록 변경
- `class_id`와 `log_date`를 조합하여 일지 매칭
- 일지 데이터에서 출석 정보 표시

### 2. daily-log-modal.tsx 수정

- 모달에 `logDate` prop 추가
- 선택한 날짜를 사용하여 일지 저장
- `schedules` 테이블 구조에 맞게 데이터 처리

## 수정할 파일

### 1. `app/academy-admin/components/views/daily-log-view.tsx`
### 2. `app/academy-admin/components/views/logs/daily-log-modal.tsx`

## TODO

1. daily-log-view.tsx에서 classes 테이블 조회를 schedules 테이블 조회로 변경
2. 일지 매칭 로직을 class_id + log_date 조합으로 수정
3. 일지 상세 표시에서 일지 데이터 우선 사용
4. daily-log-modal.tsx에 logDate prop 추가
5. daily-log-modal.tsx에서 선택한 날짜 사용
6. schedules 테이블 구조에 맞게 데이터 처리
