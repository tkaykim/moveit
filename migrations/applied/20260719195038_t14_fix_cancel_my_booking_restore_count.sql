-- FINDING 2 수정: cancel_my_booking() 이 예약만 CANCELLED 로 바꾸고 COUNT 티켓을
-- 복원하지 않아, 학생이 이 함수를 PostgREST 로 직접 호출하면 차감분이 환불 없이 소실된다.
-- 실제 앱 경로(/api/bookings/[id]/status → cancel_booking_tx)와 정합을 맞추기 위해
-- 취소+복원 로직을 단일 정본 cancel_booking_tx 에 위임한다.
--   (within-deadline 규칙 + COUNT 티켓 +1 + 중복복원 가드 = cancel_booking_tx 내부)
-- 반환 타입(bookings)·시그니처·grant 는 그대로 유지(DROP 없음, 멱등).
create or replace function public.cancel_my_booking(p_booking_id uuid)
returns bookings
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  b public.bookings;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  select * into b from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- 본인 예약만 (학생 셀프 취소). 스태프/서비스 경로는 cancel_booking_tx 직접 사용.
  if b.user_id is distinct from auth.uid() then
    raise exception 'NOT_BOOKING_OWNER' using errcode = 'insufficient_privilege';
  end if;

  if b.status not in ('CONFIRMED', 'PENDING') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'check_violation';
  end if;

  -- 취소 + (마감 이내면) COUNT 티켓 복원을 정본 함수에 위임.
  perform public.cancel_booking_tx(p_booking_id);

  select * into b from public.bookings where id = p_booking_id;
  return b;
end
$function$;;