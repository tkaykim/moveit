-- Migration: p1_signup_guest_merge_v3 (2026-05-10)
-- Purpose: signup_with_guest_merge 가 게스트 → 회원 ownership 이전을 수행할 때
--          이전된 user_ticket 마다 GUEST_MERGED 활동 로그를 남기도록 보강.
--          v2 의 안전장치(ON CONFLICT, is_guest 가드) 는 그대로 유지.
-- Depends on: p0_signup_guest_merge_v2 (선행 적용 필요)

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
  v_ticket record;
BEGIN
  v_norm_phone := CASE WHEN p_phone IS NOT NULL THEN regexp_replace(p_phone, '[^0-9]', '', 'g') ELSE NULL END;
  v_norm_email := CASE WHEN p_email IS NOT NULL THEN LOWER(TRIM(p_email)) ELSE NULL END;

  -- Phase A: 다른 게스트 행을 합치면서 ownership 이전 + 활동 로그 기록
  FOR v_guest IN
    SELECT id FROM users
    WHERE is_guest = true
      AND id != p_auth_id
      AND (
        (v_norm_email IS NOT NULL AND LOWER(email) = v_norm_email)
        OR (v_norm_phone IS NOT NULL AND phone = v_norm_phone)
      )
  LOOP
    -- 1) 이전 대상 user_tickets 를 미리 캡처해서 로그에 사용
    --    (UPDATE 후에는 어떤 행이 옮겨졌는지 식별이 어려우므로 사전 SELECT)
    FOR v_ticket IN
      SELECT ut.id AS user_ticket_id, t.academy_id, ut.ticket_id
      FROM user_tickets ut
      LEFT JOIN tickets t ON t.id = ut.ticket_id
      WHERE ut.user_id = v_guest.id
    LOOP
      INSERT INTO enrollment_activity_log
        (academy_id, user_id, user_ticket_id, action, payload, actor_user_id)
      VALUES (
        v_ticket.academy_id,
        p_auth_id,
        v_ticket.user_ticket_id,
        'GUEST_MERGED',
        jsonb_build_object(
          'via', 'guest_merge',
          'previous_user_id', v_guest.id,
          'merged_at', now(),
          'ticket_id', v_ticket.ticket_id
        ),
        p_auth_id
      );
    END LOOP;

    -- 2) ownership 이전
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

  -- Phase B: 인증된 사용자 행을 upsert (Case C 복구)
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
