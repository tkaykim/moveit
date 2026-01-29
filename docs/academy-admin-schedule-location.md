# 아카데미 어드민 - 반복일정/스케줄 생성 위치

## 반복일정 생성 기능이 있는 곳

- **경로**: 아카데미 어드민 → 왼쪽 메뉴 **일정** (스케줄)
- **URL 예**: `/academy-admin/{학원ID}/schedule`
- **화면**: **스케줄 관리** 페이지 상단 오른쪽 **"스케줄 생성"** 버튼 (Repeat 아이콘)
- **파일**:
  - 뷰: `app/academy-admin/components/views/schedule-view.tsx`
  - 모달: `app/academy-admin/components/views/schedule/recurring-schedule-modal.tsx`

## 동작 방식

- **"스케줄 생성"** 버튼 클릭 → **반복 일정 추가 모달** 열림
- 모달에서 **수업(클래스), 홀, 요일, 시작/종료 시간, 기간(시작일~종료일)** 입력 후 저장
- 저장 시 **반복 규칙(`recurring_schedules`)** 1건 생성 + **해당 기간의 세션(`schedules`)** 일괄 생성
- 즉, **새 반복 일정을 추가할 때** 그 기간에 해당하는 실제 스케줄이 함께 만들어짐

## 기존 반복 일정으로 추가 세션만 만들 때

- UI에는 **"기존 반복 일정에 대해 이번 달/다음 달 세션만 생성"** 버튼은 없음
- 같은 규칙으로 더 만들려면:
  - 같은 수업/요일/시간으로 **새 반복 일정**을 그 기간(예: 1월~2월)만 지정해 다시 저장하거나,
  - DB/스크립트로 해당 기간의 `schedules`를 직접 삽입

## 관련 코드

- 세션 날짜 생성: `lib/utils/schedule-generator.ts` — `generateSessionDates`, `combineDateAndTime`
- 반복 규칙 → 세션 일괄 생성: `lib/db/recurring-schedules.ts` — `generateSessionsFromRecurringSchedule`
