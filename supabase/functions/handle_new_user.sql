-- Supabase Auth 사용자 생성 시 users 테이블에 프로필 자동 생성
-- 이 함수는 Supabase Dashboard > Database > Functions에서 생성하거나
-- Edge Function으로 구현할 수 있습니다.

-- 방법 1: Database Trigger 사용 (권장)
-- Supabase Dashboard > Database > Triggers에서 설정

-- role 컬럼이 있는지 확인하고 적절히 처리하는 함수
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
    BEGIN
      INSERT INTO public.users (id, email, name, nickname, phone, role)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NULL),
        COALESCE(NEW.raw_user_meta_data->>'nickname', NULL),
        COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
        'USER'::user_role
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        nickname = COALESCE(EXCLUDED.nickname, public.users.nickname),
        phone = COALESCE(EXCLUDED.phone, public.users.phone);
    EXCEPTION
      WHEN OTHERS THEN
        -- role 타입이 없거나 다른 에러 발생 시 role 없이 시도
        INSERT INTO public.users (id, email, name, nickname, phone)
        VALUES (
          NEW.id,
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'name', NULL),
          COALESCE(NEW.raw_user_meta_data->>'nickname', NULL),
          COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = COALESCE(EXCLUDED.name, public.users.name),
          nickname = COALESCE(EXCLUDED.nickname, public.users.nickname),
          phone = COALESCE(EXCLUDED.phone, public.users.phone);
    END;
  ELSE
    INSERT INTO public.users (id, email, name, nickname, phone)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NULL),
      COALESCE(NEW.raw_user_meta_data->>'nickname', NULL),
      COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.users.name),
      nickname = COALESCE(EXCLUDED.nickname, public.users.nickname),
      phone = COALESCE(EXCLUDED.phone, public.users.phone);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 에러 발생 시 로그만 남기고 계속 진행 (Auth 사용자 생성은 성공)
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

