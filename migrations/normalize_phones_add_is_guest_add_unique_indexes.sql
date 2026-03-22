-- Migration: normalize_phones_add_is_guest_add_unique_indexes
-- Applied via Supabase MCP (2 migrations combined)

-- Step 1: Normalize phone numbers (remove hyphens)
UPDATE users SET phone = regexp_replace(phone, '[^0-9]', '', 'g') WHERE phone IS NOT NULL AND phone ~ '[^0-9]';

-- Step 2: Add is_guest column
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

-- Step 3: Set is_guest = true for users not in auth.users
UPDATE users SET is_guest = true WHERE id NOT IN (SELECT id FROM auth.users);

-- Step 4: Add partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (LOWER(email)) WHERE email IS NOT NULL;

-- Step 5: Add trigger to auto-normalize phone on insert/update
CREATE OR REPLACE FUNCTION normalize_user_phone() RETURNS trigger AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_user_phone ON users;
CREATE TRIGGER trg_normalize_user_phone
  BEFORE INSERT OR UPDATE OF phone ON users
  FOR EACH ROW
  EXECUTE FUNCTION normalize_user_phone();

-- Step 6: Update create_student_user RPC to set is_guest = true
DROP FUNCTION IF EXISTS create_student_user(text,text,text,text,text,date,text,text,text);
CREATE FUNCTION create_student_user(
  p_name text,
  p_nickname text,
  p_email text,
  p_phone text,
  p_name_en text,
  p_birth_date date,
  p_gender text,
  p_address text,
  p_nationality text
) RETURNS SETOF users AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.users (id, name, nickname, email, phone, name_en, birth_date, gender, address, nationality, role, is_guest)
  VALUES (
    gen_random_uuid(),
    p_name,
    p_nickname,
    p_email,
    p_phone,
    p_name_en,
    p_birth_date,
    p_gender,
    p_address,
    COALESCE(p_nationality, '한국'),
    'USER'::public.user_role,
    true
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Add signup_with_guest_merge RPC for handling signup with existing guest users
CREATE OR REPLACE FUNCTION signup_with_guest_merge(
  p_auth_id uuid,
  p_email text,
  p_name text,
  p_name_en text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_nickname text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_guest record;
  v_norm_phone text;
BEGIN
  v_norm_phone := CASE WHEN p_phone IS NOT NULL THEN regexp_replace(p_phone, '[^0-9]', '', 'g') ELSE NULL END;

  FOR v_guest IN
    SELECT id FROM users
    WHERE is_guest = true
      AND id != p_auth_id
      AND (
        (p_email IS NOT NULL AND LOWER(email) = LOWER(p_email))
        OR (v_norm_phone IS NOT NULL AND phone = v_norm_phone)
      )
  LOOP
    UPDATE bookings SET user_id = p_auth_id WHERE user_id = v_guest.id;
    UPDATE user_tickets SET user_id = p_auth_id WHERE user_id = v_guest.id;
    UPDATE revenue_transactions SET user_id = p_auth_id WHERE user_id = v_guest.id;
    UPDATE user_bookings SET user_id = p_auth_id WHERE user_id = v_guest.id;
    UPDATE user_payments SET user_id = p_auth_id WHERE user_id = v_guest.id;
    UPDATE user_ticket_payment_orders SET user_id = p_auth_id WHERE user_id = v_guest.id;
    UPDATE bank_transfer_orders SET user_id = p_auth_id WHERE user_id = v_guest.id;

    -- academy_students: 중복 방지 처리
    UPDATE academy_students SET user_id = p_auth_id
    WHERE user_id = v_guest.id
      AND academy_id NOT IN (
        SELECT academy_id FROM academy_students WHERE user_id = p_auth_id
      );
    DELETE FROM academy_students WHERE user_id = v_guest.id;

    DELETE FROM users WHERE id = v_guest.id AND is_guest = true;
  END LOOP;

  INSERT INTO users (id, email, name, name_en, phone, nickname, role, is_guest)
  VALUES (p_auth_id, p_email, p_name, p_name_en, v_norm_phone, p_nickname, 'USER'::user_role, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
