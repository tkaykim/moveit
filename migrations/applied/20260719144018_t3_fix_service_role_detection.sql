-- ============================================================================
-- 보안 수정: booking_is_service_role() 이 SECURITY DEFINER 함수 안에서 항상 true
--
-- 원인: `current_user in ('postgres','supabase_admin')`.
--   SECURITY DEFINER 함수 안에서는 current_user 가 **함수 소유자(postgres)** 로 바뀐다.
--   따라서 create_booking_tx / grant_student_membership 등 정의자 함수 내부에서 이 함수를
--   호출하면 호출자가 누구든 항상 true 가 되어,
--     - create_booking_tx 의 NOT_BOOKING_OWNER 검사 (남의 예약 생성 차단)
--     - grant_student_membership 의 NOT_ACADEMY_STAFF 검사
--   가 통째로 무력화된다.
--
-- 수정: session_user 를 쓴다. session_user 는 SECURITY DEFINER 로 바뀌지 않고
--   최초 로그인 롤을 유지한다 (PostgREST 경유 = 'authenticator').
--   서비스롤 요청은 JWT claim 으로 판별되고, 직접 psql/마이그레이션 접속만 두 번째 절에 걸린다.
-- ============================================================================
create or replace function public.booking_is_service_role()
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
           ''
         ) = 'service_role'
      or (
           session_user in ('postgres', 'supabase_admin')
           and nullif(current_setting('request.jwt.claims', true), '') is null
         );
$function$;
;