-- T2-4: 취소 트랜잭션. 복구 여부는 **서버가 판정**한다 (클라이언트 restoreTicket 플래그 불신).
-- 멱등: 이미 CANCELLED 인 예약을 다시 취소해도 횟수는 정확히 한 번만 복구된다.

create or replace function public.cancel_booking_tx(p_booking_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_is_service boolean := coalesce(
    current_setting('request.jwt.claims', true)::jsonb->>'role', ''
  ) = 'service_role' or v_caller is null;
  v_b public.bookings;
  v_class record;
  v_sched record;
  v_policy jsonb;
  v_deadline timestamptz;
  v_within boolean := false;
  v_ticket record;
  v_restored boolean := false;
  v_updated public.bookings;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select c.*, c.academy_id as acad into v_class from public.classes c where c.id = v_b.class_id;

  -- 권한: 본인 / 학원 스태프 / 슈퍼관리자 / service_role
  if not v_is_service
     and v_b.user_id is distinct from v_caller
     and not (v_class.academy_id is not null
              and (public.is_academy_staff(v_class.academy_id) or public.is_super_admin())) then
    raise exception 'NOT_BOOKING_OWNER' using errcode = 'insufficient_privilege';
  end if;

  if v_b.status not in ('CONFIRMED','PENDING','CANCELLED') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'check_violation';
  end if;

  -- 복구 마감 판정 (서버 단독 결정)
  if v_b.schedule_id is not null then
    select * into v_sched from public.schedules where id = v_b.schedule_id for update;
    if found then
      select public.booking_resolve_policy(a.booking_policy, v_class.booking_policy)
        into v_policy from public.academies a where a.id = v_class.academy_id;
      v_policy := coalesce(v_policy, public.booking_resolve_policy(null, v_class.booking_policy));
      v_deadline := public.booking_cancel_deadline_at(v_sched.start_time, v_policy);
      v_within := now() < v_deadline;
    end if;
  end if;

  -- 멱등 지점: 상태가 실제로 바뀐 호출만 복구 로직에 진입한다.
  update public.bookings set status = 'CANCELLED'
   where id = p_booking_id and status <> 'CANCELLED'
  returning * into v_updated;

  if not found then
    return jsonb_build_object(
      'ok', true, 'booking_id', p_booking_id, 'already_cancelled', true,
      'restored', false, 'within_deadline', v_within
    );
  end if;

  if v_within and v_b.user_ticket_id is not null then
    select t.* into v_ticket
      from public.user_tickets ut join public.tickets t on t.id = ut.ticket_id
     where ut.id = v_b.user_ticket_id;
    if found and upper(coalesce(v_ticket.ticket_type, '')) = 'COUNT' then
      update public.user_tickets
         set remaining_count = coalesce(remaining_count, 0) + 1,
             status = case when status = 'USED' and (coalesce(remaining_count, 0) + 1) > 0
                           then 'ACTIVE' else status end
       where id = v_b.user_ticket_id
         and remaining_count is not null;
      if found then v_restored := true; end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true, 'booking_id', p_booking_id, 'already_cancelled', false,
    'restored', v_restored, 'within_deadline', v_within
  );
end $$;

revoke all on function public.cancel_booking_tx(uuid) from public;
grant execute on function public.cancel_booking_tx(uuid) to authenticated, service_role;;