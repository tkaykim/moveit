# 구독/결제 500 에러 원인 및 해결 (리포트)

## 현상

- 카드 등록 시 "카드 등록에 성공했습니다" 문구는 정상 표시됨.
- 콘솔에 다음 API들이 **500 (Internal Server Error)** 발생:
  - `GET /api/billing/subscription?academyId=...`
  - `GET /api/billing/plans`
  - `GET /api/billing/payments?academyId=...&page=1&limit=20`
- 리프레시 후 구독/결제 관리 페이지에서 "아직 구독 정보가 없습니다", 등록된 카드 정보 미표시.

---

## 원인

- **토스 테스트키 문제가 아님.**  
  카드 등록까지 성공했다는 것은 토스 테스트 키와 빌링 발급(카드 등록) 플로우는 정상 동작한 상태입니다.
- **원인: Supabase DB에 billing 관련 테이블이 없음.**  
  - `academy_subscriptions`  
  - `billing_plans`  
  - `subscription_payments`  
  위 테이블이 없으면 위 세 API가 Supabase 조회 시 예외가 나며 **500**을 반환합니다.
- 카드 등록 API(`request-billing-auth`)는 같은 DB에 **insert/update**를 하므로, 테이블이 없으면 카드 등록 단계에서도 실패했을 수 있습니다.  
  "카드 등록 성공"이 뜨는 경우는 **이미 마이그레이션이 일부 적용된 DB**이거나, **카드 등록만 성공하고 이후 조회용 테이블이 없는** 상황일 수 있습니다.  
  정리하면, **조회 API들이 500을 내는 직접 원인은 billing 테이블 부재(또는 마이그레이션 미적용)**입니다.

---

## 해결 방법

1. **billing 마이그레이션 적용**
   - 파일: `supabase/migrations/20250219000000_billing.sql`
   - **방법 A (Supabase CLI)**  
     프로젝트 루트에서:
     ```bash
     npx supabase db push
     ```
   - **방법 B (Supabase 대시보드)**  
     - Supabase 프로젝트 → SQL Editor  
     - `supabase/migrations/20250219000000_billing.sql` 내용을 **전부 복사해 한 번에 실행**

2. **적용 후 확인**
   - 개발 서버 재시작 후 구독/결제 관리 페이지 새로고침.
   - 500 없이 구독 정보·등록 카드·결제 이력이 조회되면 정상.

---

## 토스 키 관련 정리

| 항목 | 설명 |
|------|------|
| 현재 현상의 원인 | **DB billing 테이블 미적용**으로 인한 API 500. 토스 키와 무관. |
| 테스트키로 동작 여부 | **테스트키로도 카드 등록·구독 조회 모두 정상 동작해야 함.** (마이그레이션 적용 시) |
| 문서용 vs 직접 발급 | 둘 다 사용 가능. 문서용 테스트 키 그대로 써도 되고, [토스페이먼츠 개발자센터](https://developers.tosspayments.com)에서 **나만의 테스트 키**를 발급해 `.env.local`에 넣어도 됨. 테스트 환경에서는 실제 출금/청구 없음. |

---

## 코드 측 변경 사항

- **API 오류 메시지 보강**  
  - `subscription`, `plans`, `payments` API에서 예외 메시지에 "relation does not exist" 등이 포함되면  
    → 500 응답 body에 **"billing DB 마이그레이션이 적용되었는지 확인하세요"** 문구가 포함되도록 수정.
- **문서**  
  - `docs/billing-test-keys.md`에 **사전 요구사항: billing DB 마이그레이션** 절 추가.  
  - 이 리포트: `docs/billing-500-cause-and-fix.md`
