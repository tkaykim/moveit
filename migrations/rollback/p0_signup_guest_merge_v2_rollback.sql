-- Rollback for p0_signup_guest_merge_v2
-- Restores the original signup_with_guest_merge definition from
-- migrations/normalize_phones_add_is_guest_add_unique_indexes.sql (Step 7).

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
