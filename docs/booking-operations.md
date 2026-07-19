# 운영 — 크론·큐·시드

## 크론

| 주기 | 경로 | 하는 일 |
|---|---|---|
| 5분 | `app/api/cron/process-booking-events/route.ts` | `booking_events` 처리 — 휴강 전파(횟수 복구·기간 연장·알림), 신규 회차 백필 |
| 일 1회 (15:00 UTC) | `app/api/cron/expire-tickets/route.ts` | 수강권 만료, 멤버십 만료, 계좌이체 홀드 만료, 고정반 배치, 이벤트 처리(이중 안전망) |

일일 크론은 **독립 concern 구조**다 — 하나가 실패해도 나머지가 계속 돌고 각각 결과가 따로 기록된다. 새 정기 작업은 이 구조 안에 concern으로 추가한다.

이벤트 처리기는 전부 **멱등**이다. 더 자주 돌려도 안전하고, 두 번 처리해도 두 번 복구하지 않는다.

## 운영 큐 (재처리 대시보드)

관리자 화면 `운영 → 재처리`에 다섯 목록이 있다. **실패를 로그에만 남기지 않는다**는 것이 설계 의도다 — 현장에서 로그는 안 읽힌다.

1. 결제는 승인됐는데 이행이 끝나지 않은 주문 (`PAYMENT_APPROVED` / `FULFILLMENT_FAILED`) — 재시도 버튼
2. 실패한 `booking_events` (`attempts` / `last_error` 표시)
3. 고정반 자동 배치 실패·건너뜀 (`fixed_weekly_placement_issues`)
4. 만료된 멤버십인데 미래 전용수업 예약이 남은 학생 — 유지/취소/재지정
5. **예약 준비 안 된 수업** — 외부 일정 도구가 만든 수업은 수업군이 없어 여기 쌓인다. 태깅(개별·일괄)해야 학생에게 노출된다.

5번은 버그가 아니라 **상시 운영 흐름**이다. 외부 도구는 예약 도메인을 모르므로, 새 수업의 수업군·공개범위·예약규칙은 운영자가 정한다.

## MID 학원 시드

- `scripts/seed-mid.mjs` — 멱등. 두 번 돌려도 0행 변경.
- `scripts/revert-mid-seed.mjs` — 되돌리기(설정한 두 컬럼만 복원, 시드 행은 지우지 않음).
- `scripts/verify-mid-seed.mjs` — 라이브 데이터 대조 검증.
- 설정 정본: `scripts/mid-seed-config.mjs` (수업군·상품·멤버십·예약정책 한 곳).

시드가 하는 일: 수업군 4종 · 상품 7종 · 커버리지 · 멤버십 2종(비공개) · 학원 예약정책 · 기존 수업 태깅.
`academies.is_active`는 **false로 유지**한다 — 시드는 다크런치이고, 학생 노출은 사람의 결정이다.

⚠ 시드는 `booking_policy` 비교에 **키 순서 무관 직렬화**를 쓴다. Postgres가 jsonb 키를 재정렬하므로 단순 문자열 비교로는 매번 "다르다"고 판단해 멱등성이 깨진다.

## 검증

```
npx tsc --noEmit
npm run lint
npm run build
npx playwright test --workers=1        # 병렬 금지
node scripts/verify-t1-schema.mjs      # 스키마·제약·인덱스·RLS
node scripts/verify-mid-seed.mjs       # MID 시드 대조
node scripts/verify-no-test-leftovers.mjs   # 픽스처 잔여 감사
```

테스트는 **라이브 DB에 픽스처를 만들고 지운다.** 각 스펙은 자기 픽스처를 정리할 책임이 있고, 잔여 감사 스크립트가 이를 강제한다. 정리 코드에서 `supabase-js`의 `delete`는 **실패해도 예외를 던지지 않으므로** FK 순서를 틀리면 조용히 남는다 — 삭제 순서를 FK 역순으로 짜고 결과를 확인한다.
