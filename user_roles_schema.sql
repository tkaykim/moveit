-- 사용자 역할 및 권한 관리 스키마

-- 1. 사용자 역할 enum 타입 생성
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ACADEMY_OWNER', 'ACADEMY_MANAGER', 'INSTRUCTOR', 'USER');

-- 2. users 테이블에 role 컬럼 추가
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'USER';

-- 3. academy_users 테이블 생성 (학원-사용자 관계)
-- 학원 소유자, 매니저, 강사 등의 관계를 관리
CREATE TABLE IF NOT EXISTS public.academy_users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  academy_id uuid NOT NULL,
  role user_role NOT NULL, -- ACADEMY_OWNER, ACADEMY_MANAGER, INSTRUCTOR
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT academy_users_pkey PRIMARY KEY (id),
  CONSTRAINT academy_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT academy_users_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE,
  CONSTRAINT academy_users_unique UNIQUE (user_id, academy_id, role)
);

-- 4. instructor_users 테이블 생성 (강사-사용자 관계)
-- 강사 프로필과 사용자 계정 연결
CREATE TABLE IF NOT EXISTS public.instructor_users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT instructor_users_pkey PRIMARY KEY (id),
  CONSTRAINT instructor_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT instructor_users_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id) ON DELETE CASCADE,
  CONSTRAINT instructor_users_unique UNIQUE (user_id, instructor_id)
);

-- 5. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_academy_users_user_id ON public.academy_users(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_users_academy_id ON public.academy_users(academy_id);
CREATE INDEX IF NOT EXISTS idx_instructor_users_user_id ON public.instructor_users(user_id);
CREATE INDEX IF NOT EXISTS idx_instructor_users_instructor_id ON public.instructor_users(instructor_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 6. updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. academy_users 테이블에 트리거 추가
CREATE TRIGGER update_academy_users_updated_at 
    BEFORE UPDATE ON public.academy_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. 초기 데이터 예시 (선택사항)
-- SUPER_ADMIN 사용자 생성 예시:
-- UPDATE public.users SET role = 'SUPER_ADMIN' WHERE email = 'admin@example.com';

-- 학원-사용자 연결 예시:
-- INSERT INTO public.academy_users (user_id, academy_id, role)
-- SELECT u.id, a.id, 'ACADEMY_OWNER'
-- FROM public.users u, public.academies a
-- WHERE u.email = 'owner@example.com' AND a.name_kr = '예시 학원';


