# Billing 마이그레이션 적용 방법

## 추가 마이그레이션: status 'card_only' (2025-02-19)

카드만 등록된 상태(플랜 미선택)를 구분하기 위해 `academy_subscriptions.status`에 `card_only`가 추가되었습니다.  
이미 billing 테이블을 적용한 프로젝트는 아래 SQL을 한 번 더 실행하세요.

```sql
ALTER TABLE academy_subscriptions DROP CONSTRAINT IF EXISTS academy_subscriptions_status_check;
ALTER TABLE academy_subscriptions ADD CONSTRAINT academy_subscriptions_status_check
  CHECK (status IN ('card_only', 'trial', 'active', 'past_due', 'canceled', 'expired'));
```

---

# Billing 최초 마이그레이션 직접 적용 방법

Supabase MCP가 연결된 프로젝트에는 `academies` 테이블이 없어, 여기서는 billing 마이그레이션을 대신 실행할 수 없습니다. **앱이 사용하는 Supabase 프로젝트**에서 아래 중 한 가지 방법으로 적용하세요.

## 방법 1: Supabase 대시보드 (권장)

1. [Supabase Dashboard](https://supabase.com/dashboard) 로그인 후, **MOVEIT 앱이 사용하는 프로젝트** 선택.
2. 왼쪽 메뉴 **SQL Editor** 클릭.
3. **New query** 선택 후, 아래 파일 내용을 **전체 복사**해 붙여넣기:
   - `supabase/migrations/20250219000000_billing.sql`
4. **Run** (또는 Ctrl+Enter) 실행.
5. 에러 없이 완료되면 billing 테이블·정책·시드가 적용된 상태입니다.

## 방법 2: Supabase CLI

앱에서 사용하는 Supabase 프로젝트가 CLI로 연결되어 있다면:

```bash
# 프로젝트 루트에서
npx supabase db push
```

또는 원격 DB URL을 지정해 마이그레이션만 적용:

```bash
npx supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

(환경에 맞게 비밀번호·프로젝트 REF는 치환.)

## 적용 후 확인

- 구독/결제 관리 페이지 새로고침 시 500 없이 로드되는지 확인.
- 카드 등록 후 등록한 카드·구독 정보가 보이는지 확인.
