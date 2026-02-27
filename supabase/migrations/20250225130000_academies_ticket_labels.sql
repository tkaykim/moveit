-- 학원별 수강권 유형 표기 (표시 이름만 변경, ticket_category 값은 유지)
ALTER TABLE academies
  ADD COLUMN IF NOT EXISTS ticket_label_regular TEXT,
  ADD COLUMN IF NOT EXISTS ticket_label_popup TEXT,
  ADD COLUMN IF NOT EXISTS ticket_label_workshop TEXT;

COMMENT ON COLUMN academies.ticket_label_regular IS '기간제 수강권 표시 이름. NULL이면 기본 "기간제 수강권"';
COMMENT ON COLUMN academies.ticket_label_popup IS '쿠폰제(횟수제) 수강권 표시 이름. NULL이면 기본 "쿠폰제(횟수제) 수강권"';
COMMENT ON COLUMN academies.ticket_label_workshop IS '워크샵(특강) 수강권 표시 이름. NULL이면 기본 "워크샵(특강) 수강권"';
