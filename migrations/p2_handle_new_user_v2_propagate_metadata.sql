-- Migration: p2_handle_new_user_v2_propagate_metadata (2026-05-11)
-- Purpose: handle_new_user trigger 가 auth.users.raw_user_meta_data 의
--          name/phone/nickname/full_name 을 public.users 에 채우도록 v2 로 보강.
--
-- v1 (20260120) 은 (id, email) 만 INSERT 해서 사용자가 가입 폼에 입력했거나
-- OAuth provider 가 제공한 이름/전화번호가 모두 버려지는 사고가 있었음:
--   - 이메일 가입: frontend 가 signUp options.data 로 metadata 를 보내야 raw_user_meta_data
--     에 들어감 (이 PR 에서 AuthContext 도 함께 수정).
--   - OAuth (Google 등): provider 가 name/full_name/avatar_url 을 raw_user_meta_data 에
--     자동으로 넣어줌 — trigger 가 이를 읽기만 하면 됨.
--
-- ON CONFLICT 가드: signup_with_guest_merge RPC 가 먼저 행을 만든 race 케이스 대비.
-- 빈 필드만 채우고 이미 값이 있으면 보존.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_name_en text;
  v_phone text;
  v_nickname text;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NULL
  );
  v_name_en := NEW.raw_user_meta_data->>'name_en';
  v_phone := CASE
    WHEN NEW.raw_user_meta_data->>'phone' IS NOT NULL
    THEN regexp_replace(NEW.raw_user_meta_data->>'phone', '[^0-9]', '', 'g')
    ELSE NULL
  END;
  v_nickname := NEW.raw_user_meta_data->>'nickname';

  INSERT INTO public.users (id, email, name, name_en, phone, nickname, role, is_guest, created_at, updated_at)
  VALUES (
    NEW.id,
    LOWER(TRIM(NEW.email)),
    v_name,
    v_name_en,
    NULLIF(v_phone, ''),
    v_nickname,
    'USER'::user_role,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name     = COALESCE(public.users.name,     EXCLUDED.name),
    name_en  = COALESCE(public.users.name_en,  EXCLUDED.name_en),
    phone    = COALESCE(public.users.phone,    EXCLUDED.phone),
    nickname = COALESCE(public.users.nickname, EXCLUDED.nickname),
    updated_at = NOW();

  RETURN NEW;
END;
$$;
