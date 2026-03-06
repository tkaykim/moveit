-- 수강신청/취소/환불/연장/횟수 변동 등 활동 이력 (활동로그 탭용)
CREATE TABLE IF NOT EXISTS enrollment_activity_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id       UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  user_ticket_id   UUID REFERENCES user_tickets(id) ON DELETE SET NULL,
  booking_id       UUID REFERENCES bookings(id) ON DELETE SET NULL,
  extension_request_id UUID REFERENCES ticket_extension_requests(id) ON DELETE SET NULL,
  action           VARCHAR(32) NOT NULL,
  payload          JSONB,
  actor_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE enrollment_activity_log IS '수강신청·취소·환불·연장·횟수 차감/복구 등 활동 이력. 활동로그 탭 조회용';
COMMENT ON COLUMN enrollment_activity_log.action IS 'ENROLL, CANCEL, REFUND, EXTENSION_APPROVED, COUNT_DEDUCT, COUNT_RESTORE 등';
COMMENT ON COLUMN enrollment_activity_log.payload IS '횟수 변동(delta), 수강권/예약 요약 등 JSON';
COMMENT ON COLUMN enrollment_activity_log.actor_user_id IS '작업 수행자(관리자 등). null이면 시스템/회원 본인';

CREATE INDEX IF NOT EXISTS idx_enrollment_activity_log_academy_created
  ON enrollment_activity_log(academy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_activity_log_user_created
  ON enrollment_activity_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollment_activity_log_booking
  ON enrollment_activity_log(booking_id) WHERE booking_id IS NOT NULL;
