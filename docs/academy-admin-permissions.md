# 학원 관리자 권한

## 누가 권한을 가지는가

특정 학원의 **학원 관리자** 페이지(대시보드, 수동 입금확인, 스케줄 등)에 접근할 수 있는 경우:

1. **SUPER_ADMIN**  
   `users.role = 'SUPER_ADMIN'` 인 사용자 → **모든 학원**에 대해 접근 가능.

2. **해당 학원의 학원관리자**  
   `academy_user_roles` 테이블에 해당 `academy_id`에 대해  
   `role`이 `ACADEMY_OWNER` 또는 `ACADEMY_MANAGER`인 행이 있는 사용자 → **그 학원만** 접근 가능.

즉, **디프런프롬세임**에 대해서는:

- **SUPER_ADMIN** → 디프런프롬세임 포함 모든 학원 권한 있음.
- **디프런프롬세임의 학원관리자** → `academy_user_roles`에 디프런프롬세임(`academy_id` 아래 참고)으로 등록된 ACADEMY_OWNER/ACADEMY_MANAGER → 디프런프롬세임 권한 있음.

## 디프런프롬세임 학원 ID

- **academy_id**: `462980c8-ba5e-4b06-9d47-c9786d44b7d4`
- **name_kr**: 디프런프롬세임  
- **name_en**: DifferentFromSame

## 학원관리자 배정 방법

### 방법 1: Admin UI (권장)

1. **SUPER_ADMIN** 계정으로 로그인.
2. **Admin > 사용자 관리** (`/admin/users`) 이동.
3. 학원관리자로 지정할 사용자 선택 → **학원 역할**에서  
   학원 **디프런프롬세임** 선택, 역할 **ACADEMY_OWNER** 또는 **ACADEMY_MANAGER** 선택 후 저장.

### 방법 2: SQL로 직접 등록

Supabase SQL Editor 등에서 아래처럼 실행.  
`YOUR_USER_ID`는 학원관리자로 지정할 사용자의 `auth.users.id`(또는 `public.users.id`)로 바꿉니다.

```sql
INSERT INTO academy_user_roles (user_id, academy_id, role)
VALUES (
  'YOUR_USER_ID',
  '462980c8-ba5e-4b06-9d47-c9786d44b7d4',
  'ACADEMY_OWNER'
)
ON CONFLICT DO NOTHING;
```

- `ACADEMY_MANAGER`로 하려면 `role`만 `'ACADEMY_MANAGER'`로 변경.
- 같은 사용자·같은 학원에 대해 이미 행이 있으면 `ON CONFLICT DO NOTHING`으로 중복 방지.

## 코드 참고

- 권한 검사 공통 로직: `lib/supabase/academy-admin-auth.ts`의 `assertAcademyAdmin(academyId, userId)`.
- 학원 역할 추가/삭제 API: `POST/DELETE /api/admin/users/academy-roles` (SUPER_ADMIN 전용).
