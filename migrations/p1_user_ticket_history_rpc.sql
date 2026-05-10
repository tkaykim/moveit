-- Migration: p1_user_ticket_history_rpc (2026-05-10)
-- Purpose: 단일 user_ticket 의 전체 활동 이력을 시간순으로 조회하는 감사용 RPC.
--          관리자 화면이나 감사자 SQL 에서 ticket lifecycle 을 쉽게 재구성할 수 있게 한다.

CREATE OR REPLACE FUNCTION get_ticket_history(p_user_ticket_id uuid)
RETURNS TABLE (
  event_at timestamptz,
  action text,
  payload jsonb,
  actor uuid,
  booking_id uuid
)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    created_at AS event_at,
    action::text,
    payload,
    actor_user_id AS actor,
    booking_id
  FROM enrollment_activity_log
  WHERE user_ticket_id = p_user_ticket_id
  ORDER BY created_at ASC;
$$;

COMMENT ON FUNCTION get_ticket_history(uuid) IS
  '특정 user_ticket 의 발급/사용/만료/환불 등 전체 이벤트 트레일을 시간순으로 반환.';
