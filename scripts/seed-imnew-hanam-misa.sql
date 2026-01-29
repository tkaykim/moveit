-- 아임뉴댄스 하남미사점 시드 데이터 (Supabase SQL Editor 또는 MCP execute_sql로 순서대로 실행)
-- Phase 1은 이미 적용됨. 아래 ID 사용.
-- academy_id: dc87f10c-fe78-4c71-b158-b5b963ac7e58
-- hall_id:    9f1b4a5b-0321-405e-bf62-9f1ae7159b3a (메인 스튜디오)

-- ========== Phase 1: 학원 및 홀 (완료) ==========
-- INSERT INTO public.academies (name_kr, name_en, address, tags, is_active)
-- VALUES ('아임뉴댄스 하남미사점', 'IMNEW HANAM MISA', '경기도 하남시 미사강변동로 84번길 21, 남송타워 5층', '취미댄스,케이팝댄스,초보반,키즈댄스', true);
-- INSERT INTO public.halls (academy_id, name, capacity) VALUES ('dc87f10c-fe78-4c71-b158-b5b963ac7e58', '메인 스튜디오', 20);

-- ========== Phase 2~3: classes, recurring_schedules, schedules ==========
-- classes는 각 수업별 1행, recurring_schedules는 요일/시간 규칙 1행
-- days_of_week: 0=일,1=월,2=화,3=수,4=목,5=금,6=토
-- 예: 오전반 기초댄스 (화/목 12:00-13:00)
--    class INSERT → recurring_schedule INSERT (days_of_week = {2,4}, start_time='12:00', end_time='13:00')
-- schedules는 generateSessionsFromRecurringSchedule 로직으로 생성하거나, 앱 Admin에서 반복일정 생성 실행

-- ========== Phase 4: tickets ==========
-- 취미반 1회 쿠폰
-- INSERT INTO public.tickets (academy_id, name, price, ticket_type, total_count, valid_days, is_coupon, access_group, ticket_category, is_public, is_on_sale)
-- VALUES ('@academy_id', '1회 쿠폰 (취미반)', 25000, 'COUNT', 1, null, true, 'general', 'regular', true, true);

-- 취미반 1개월 주2회
-- INSERT INTO public.tickets (academy_id, name, price, ticket_type, total_count, valid_days, is_coupon, access_group, ticket_category, is_public, is_on_sale)
-- VALUES ('@academy_id', '1개월 수강 (주2회 60분)', 150000, 'PERIOD', null, 30, false, 'general', 'regular', true, true);

-- (나머지 취미반/심화반/트레이닝반 동일 패턴)

-- ========== Phase 5: ticket_classes ==========
-- 각 ticket_id에 대해 해당하는 class_id 들을 ticket_classes에 INSERT

-- ========== Phase 6: discounts ==========
-- INSERT INTO public.discounts (academy_id, name, discount_type, discount_value, is_active, description)
-- VALUES ('@academy_id', '성인취미반 3개월 7만원 할인', 'FIXED', 70000, true, '성인취미반 3개월 수강 시 7만원 할인 (정가 40만원 → 33만원)');
