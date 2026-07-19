-- FINDING 3 수정: SECURITY DEFINER 함수 search_path 고정 (멱등).
-- get_academy_students_paginated, create_student_user: search_path 미고정 → 고정.
-- booking_ticket_covers_class: public 만 고정되어 있어 pg_temp 누락 → 보강.
alter function public.get_academy_students_paginated(p_academy_id uuid, p_search text, p_offset integer, p_limit integer)
  set search_path = public, pg_temp;
alter function public.create_student_user(p_name text, p_nickname text, p_email text, p_phone text, p_name_en text, p_birth_date date, p_gender text, p_address text, p_nationality text)
  set search_path = public, pg_temp;
alter function public.booking_ticket_covers_class(p_ticket_id uuid, p_class_id uuid)
  set search_path = public, pg_temp;;