-- T2-5 보안 수정:
--  (a) anon 은 예약 엔진 함수를 실행할 수 없다 (Supabase 기본권한이 anon 에 EXECUTE 를 준다).
--  (b) SECURITY DEFINER 안에서 "auth.uid() is null" 을 service_role 로 간주하던 판정을 제거한다.
--      (anon 호출 시 v_caller 가 null 이므로 임의 p_user_id 로 남의 예약을 만들 수 있었다)
--  (c) helper 함수 search_path 고정.

create or replace function public.booking_is_service_role()
returns boolean language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    ''
  ) = 'service_role'
     or current_user in ('postgres', 'supabase_admin');
$$;

-- (c) search_path 고정
alter function public.kst_date(timestamptz) set search_path = public, pg_temp;
alter function public.kst_inclusive_expiry(date, int) set search_path = public, pg_temp;
alter function public.kst_months_expiry(date, int) set search_path = public, pg_temp;
alter function public.booking_resolve_policy(jsonb, jsonb) set search_path = public, pg_temp;
alter function public.booking_open_at(timestamptz, jsonb) set search_path = public, pg_temp;
alter function public.booking_close_at(timestamptz, jsonb) set search_path = public, pg_temp;
alter function public.booking_cancel_deadline_at(timestamptz, jsonb) set search_path = public, pg_temp;
alter function public.booking_is_service_role() set search_path = public, pg_temp;
alter function public.trg_enforce_schedule_capacity() set search_path = public, pg_temp;
alter function public.trg_sync_schedule_student_count() set search_path = public, pg_temp;

-- (a) anon 차단
revoke execute on function public.create_booking_tx(uuid, uuid, uuid, uuid) from anon;
revoke execute on function public.cancel_booking_tx(uuid) from anon;
revoke execute on function public.booking_ticket_covers_class(uuid, uuid) from anon;
revoke execute on function public.booking_is_service_role() from anon;;