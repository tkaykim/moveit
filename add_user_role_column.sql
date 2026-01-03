-- users 테이블에 role 컬럼 추가
-- user_roles_schema.sql이 실행되지 않은 경우를 대비한 독립 실행 스크립트

-- 1. user_role enum 타입이 없으면 생성
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ACADEMY_OWNER', 'ACADEMY_MANAGER', 'INSTRUCTOR', 'USER');
    END IF;
END $$;

-- 2. users 테이블에 role 컬럼 추가 (없는 경우만)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'USER';

-- 3. 기존 사용자들의 role을 USER로 설정 (NULL인 경우)
UPDATE public.users 
SET role = 'USER' 
WHERE role IS NULL;

-- 4. role 컬럼에 NOT NULL 제약 추가
ALTER TABLE public.users 
ALTER COLUMN role SET NOT NULL;

-- 5. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

