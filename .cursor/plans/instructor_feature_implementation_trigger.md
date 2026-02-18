# 강사 기능 구현 — 자동 연속 진행 트리거

이 문서는 **강사 계정 및 내 수업 보기** 기능 구현 시, Cursor/에이전트가 한 todo 완료 후 **사용자 확인 없이 다음 todo로 바로 이어가도록** 하기 위한 지시사항입니다.

## 진행 원칙

1. **Todo 순서**: 아래 IMPLEMENTATION_ORDER에 적힌 순서대로만 진행한다.
2. **멈추지 않음**: 각 todo를 완료하면 즉시 다음 todo를 시작한다. 사용자에게 "다음 진행할까요?"라고 묻지 않는다.
3. **예외**: 다음 경우에만 멈추고 사용자에게 알린다.
   - Supabase 마이그레이션 등 **사용자만 실행 가능한 작업**이 있을 때 (해당 작업 내용과 실행 방법만 안내).
   - 구현 중 **요구사항/설계가 불명확**해 결정이 필요할 때.
   - **빌드/테스트 실패**가 나고 원인 파악이 어려울 때.

## IMPLEMENTATION_ORDER (순서)

| 순서 | Todo ID | 내용 |
|------|---------|------|
| 1 | 1-db-migration | DB: instructors.user_id 마이그레이션 SQL 파일 작성 |
| 2 | 2-types-instructors | types/database.ts + lib/db/instructors getInstructorByUserId |
| 3 | 3-auth-profile | AuthContext + profile API에 instructor_id, isInstructor 반영 |
| 4 | 4-api-me | GET /api/instructor/me 구현 |
| 5 | 5-api-my-schedule | GET /api/instructor/my-schedule 구현 |
| 6 | 6-api-schedule-detail | GET /api/instructor/schedule/[scheduleId] 구현 |
| 7 | 7-dashboard-ui | 강사 대시보드 페이지/뷰/수업상세 모달 |
| 8 | 8-my-page-card | 마이페이지 '내 수업 관리 (강사용)' 진입 카드 |
| 9 | 9-admin-link-api | PATCH academy-admin instructors link-user API |
| 10 | 10-admin-link-ui | 강사 모달에 유저 계정 연결 UI |

## 범위에서 제외

- **회원가입 후 자동 연결**: 이번 구현에 포함하지 않음. 수동 연결만 지원.

## 참조 계획

- `.cursor/plans/강사_계정_및_내_수업_보기_f148ad77.plan.md` (또는 동일 이름의 plan 파일)
