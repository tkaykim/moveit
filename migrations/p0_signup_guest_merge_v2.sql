-- Migration: p0_signup_guest_merge_v2 (2026-04-20)
-- Purpose: Fix Case C where a row in public.users with is_guest=true shares the same id as an
--          existing auth.users entry. The original RPC's final INSERT caused PK conflict and
--          permanently blocked signup. v2 uses ON CONFLICT (id) DO UPDATE, guarded by
--          WHERE users.is_guest = true to prevent overwriting legitimate members.
-- Rollback: see migrations/rollback/p0_signup_guest_merge_v2_rollback.sql

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
  v_norm_email text;
BEGIN
  v_norm_phone := CASE WHEN p_phone IS NOT NULL THEN regexp_replace(p_phone, '[^0-9]', '', 'g') ELSE NULL END;
  v_norm_email := CASE WHEN p_email IS NOT NULL THEN LOWER(TRIM(p_email)) ELSE NULL END;

  -- Phase A: Merge any other guest rows matching by email or phone (id != p_auth_id)
  FOR v_guest IN
    SELECT id FROM users
    WHERE is_guest = true
      AND id != p_auth_id
      AND (
        (v_norm_email IS NOT NULL AND LOWER(email) = v_norm_email)
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

  -- Phase B: Upsert the authenticated user row.
  -- ON CONFLICT (id) DO UPDATE recovers Case C (orphan is_guest row sharing auth.users.id).
  -- The WHERE users.is_guest = true guard prevents overwriting a legitimate existing member.
  INSERT INTO users (id, email, name, name_en, phone, nickname, role, is_guest)
  VALUES (p_auth_id, v_norm_email, p_name, p_name_en, v_norm_phone, p_nickname, 'USER'::user_role, false)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    phone = EXCLUDED.phone,
    nickname = EXCLUDED.nickname,
    role = 'USER'::user_role,
    is_guest = false
  WHERE users.is_guest = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
