# 인증 시스템 설정 가이드

Supabase Auth를 이용한 회원가입 및 로그인 기능이 구현되었습니다.

## 구현된 기능

### 1. 인증 API 라우트
- `POST /api/auth/signup` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/session` - 현재 세션 확인

### 2. 인증 컨텍스트
- `lib/auth/auth-context.tsx` - 전역 인증 상태 관리
- `useAuth()` 훅을 통해 어디서나 사용자 정보 접근 가능

### 3. 인증 페이지
- `/auth/login` - 로그인 페이지
- `/auth/signup` - 회원가입 페이지

### 4. 미들웨어
- 세션 자동 새로고침
- 보호된 라우트 접근 제어 (`/admin` 등)
- 로그인 상태에 따른 리다이렉트

## 설정 방법

### 1. Supabase Database Trigger 설정 (필수)

Supabase Auth에서 사용자가 생성될 때 자동으로 `users` 테이블에 프로필을 생성하도록 트리거를 설정해야 합니다.

#### Supabase Dashboard에서 설정:

1. Supabase Dashboard 접속
2. **Database** → **Functions** 메뉴로 이동
3. 다음 SQL을 실행:

```sql
-- 사용자 프로필 자동 생성 함수 (role 컬럼 유무에 관계없이 작동)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  has_role_column BOOLEAN;
BEGIN
  -- role 컬럼 존재 여부 확인
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'role'
  ) INTO has_role_column;

  -- role 컬럼이 있으면 role 포함, 없으면 제외
  IF has_role_column THEN
    INSERT INTO public.users (id, email, name, nickname, phone, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NULL),
      COALESCE(NEW.raw_user_meta_data->>'nickname', NULL),
      COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
      'USER'::user_role
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.users (id, email, name, nickname, phone)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NULL),
      COALESCE(NEW.raw_user_meta_data->>'nickname', NULL),
      COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 에러 발생 시 로그만 남기고 계속 진행
    RAISE WARNING '프로필 생성 중 오류 발생: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

또는 `supabase/functions/handle_new_user.sql` 파일의 내용을 Supabase SQL Editor에서 실행하세요.

### 2. users 테이블에 role 컬럼 추가 (아직 안 했다면)

`user_roles_schema.sql` 파일을 Supabase SQL Editor에서 실행하여 역할 시스템을 설정하세요.

### 3. Row Level Security (RLS) 정책 설정

Supabase Dashboard에서 다음 RLS 정책을 설정하세요:

```sql
-- users 테이블: 자신의 프로필만 조회 가능
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- users 테이블: 자신의 프로필만 수정 가능
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id);
```

## 사용 방법

### 컴포넌트에서 인증 사용

```tsx
'use client';

import { useAuth } from '@/lib/auth/auth-context';

export default function MyComponent() {
  const { user, profile, loading, signIn, signOut } = useAuth();

  if (loading) {
    return <div>로딩 중...</div>;
  }

  if (!user) {
    return (
      <button onClick={() => signIn('email@example.com', 'password')}>
        로그인
      </button>
    );
  }

  return (
    <div>
      <p>안녕하세요, {profile?.name || profile?.nickname || user.email}님!</p>
      <button onClick={signOut}>로그아웃</button>
    </div>
  );
}
```

### 서버 컴포넌트에서 사용자 정보 가져오기

```tsx
import { createClient } from '@/lib/supabase/server';

export default async function ServerComponent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>로그인이 필요합니다.</div>;
  }

  return <div>안녕하세요, {user.email}님!</div>;
}
```

### 보호된 라우트

`/admin` 경로는 미들웨어에서 자동으로 보호됩니다. 로그인하지 않은 사용자는 `/auth/login`으로 리다이렉트됩니다.

## 역할 기반 접근 제어

`user_roles_schema.sql`에 정의된 역할 시스템을 사용할 수 있습니다:

- `SUPER_ADMIN` - 최고 관리자
- `ACADEMY_OWNER` - 학원 소유자
- `ACADEMY_MANAGER` - 학원 매니저
- `INSTRUCTOR` - 강사
- `USER` - 일반 사용자 (기본값)

역할 확인 예시:

```tsx
const { profile } = useAuth();

if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ACADEMY_OWNER') {
  // 관리자 기능 표시
}
```

## 문제 해결

### 1. "400 Bad Request" 에러

회원가입 시 400 에러가 발생하는 경우:

**가능한 원인:**
- 이메일 형식이 올바르지 않음
- 비밀번호가 6자 미만
- 이미 등록된 이메일
- Supabase 환경 변수 설정 오류
- 데이터베이스 스키마 문제

**해결 방법:**
1. 브라우저 개발자 도구(F12) → Console 탭에서 상세 에러 메시지 확인
2. 서버 콘솔에서 상세 로그 확인
3. Supabase Dashboard > Authentication > Users에서 사용자 생성 여부 확인
4. `.env.local` 파일의 환경 변수 확인:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 2. "프로필 생성 실패" 에러

- Supabase Database Trigger가 제대로 설정되었는지 확인
- `users` 테이블에 `role` 컬럼이 있는지 확인 (없어도 작동함)
- `user_roles_schema.sql`이 실행되었는지 확인
- 트리거가 없어도 API에서 프로필을 생성하므로 큰 문제는 없음

### 3. 로그인 후 사용자 정보가 표시되지 않음

- 브라우저 개발자 도구에서 쿠키 확인
- Supabase Dashboard > Authentication > Users에서 사용자 생성 확인
- `users` 테이블에 해당 사용자 프로필이 있는지 확인
- 브라우저 캐시 및 쿠키 삭제 후 재시도

### 4. 미들웨어가 작동하지 않음

- `middleware.ts` 파일이 프로젝트 루트에 있는지 확인
- Next.js 개발 서버 재시작
- 환경 변수가 올바르게 설정되었는지 확인

### 5. 네트워크 오류

- 인터넷 연결 확인
- Supabase 프로젝트가 활성화되어 있는지 확인
- 방화벽 또는 프록시 설정 확인

## 추가 기능 구현 가능

- 이메일 인증
- 비밀번호 재설정
- 소셜 로그인 (Google, Kakao 등)
- 2단계 인증
- 세션 관리 (자동 로그아웃 등)

