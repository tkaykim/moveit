-- T2-3: 예약 확정 트랜잭션. 클라이언트/사전검사를 절대 신뢰하지 않고 락 아래에서 전부 재검증한다.
-- 검증 순서(고정): 스케줄 락 → ① class_group → ② 스페셜 규칙 → ③ audience → ④ open/close
--                → ⑤ 커버리지 → ⑥ 수업일 기준 유효기간 → ⑦ 중복 → ⑧ 정원 → 차감+예약 생성

create or replace function public.create_booking_tx(
  p_schedule_id uuid,
  p_user_ticket_id uuid default null,
  p_order_item_id uuid default null,
  p_user_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_is_service boolean := coalesce(
    current_setting('request.jwt.claims', true)::jsonb->>'role', ''
  ) = 'service_role' or v_caller is null;
  v_user_id uuid;
  v_sched record;
  v_class record;
  v_group_is_special boolean;
  v_policy jsonb;
  v_open timestamptz;
  v_close timestamptz;
  v_class_date date;
  v_designated uuid;
  v_ut record;
  v_ticket record;
  v_cap int;
  v_cur int;
  v_booking public.bookings;
  v_started boolean := false;
  v_new_start date;
  v_new_expiry date;
  v_deducted boolean := false;
  v_covered boolean;
  v_has_explicit boolean;
begin
  v_user_id := coalesce(p_user_id, v_caller);
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;
  -- 남의 예약을 대신 만들 수 있는 건 service_role 뿐
  if not v_is_service and v_user_id is distinct from v_caller then
    raise exception 'NOT_BOOKING_OWNER' using errcode = 'insufficient_privilege';
  end if;

  -- === 스케줄 행 잠금 ===
  select * into v_sched from public.schedules where id = p_schedule_id for update;
  if not found then
    raise exception 'SCHEDULE_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_sched.is_canceled then
    raise exception 'SCHEDULE_CANCELED' using errcode = 'check_violation';
  end if;

  v_class_date := public.kst_date(v_sched.start_time);

  select c.*, coalesce(g.is_special, false) as grp_special
    into v_class
    from public.classes c
    left join public.class_groups g on g.id = c.class_group_id
   where c.id = v_sched.class_id;
  if not found then
    raise exception 'CLASS_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  v_group_is_special := v_class.grp_special;

  -- ① class_group 존재
  if v_class.class_group_id is null then
    raise exception 'CLASS_NOT_BOOKABLE' using errcode = 'check_violation';
  end if;

  -- ③ audience 자격 (② 스페셜 규칙은 수강권 확정 후 검사 — 아래 참조)
  if v_class.audience_membership_id is not null then
    if not exists (
      select 1 from public.student_memberships sm
       where sm.user_id = v_user_id
         and sm.membership_id = v_class.audience_membership_id
         and sm.status = 'ACTIVE'
         and sm.start_date <= v_class_date
         and (sm.end_date is null or sm.end_date >= v_class_date)
    ) then
      raise exception 'AUDIENCE_NOT_ELIGIBLE' using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- ④ open / close 창
  select public.booking_resolve_policy(a.booking_policy, v_class.booking_policy)
    into v_policy
    from public.academies a where a.id = v_class.academy_id;
  v_policy := coalesce(v_policy, public.booking_resolve_policy(null, v_class.booking_policy));

  v_open := public.booking_open_at(v_sched.start_time, v_policy);
  v_close := public.booking_close_at(v_sched.start_time, v_policy);
  if v_open is not null and now() < v_open then
    raise exception 'BOOKING_NOT_YET_OPEN' using errcode = 'check_violation';
  end if;
  if now() >= v_close then
    raise exception 'BOOKING_CLOSED' using errcode = 'check_violation';
  end if;

  -- === 수강권 결정 ===
  -- ① 지정권 (order_items.source_purchase_item_id 링크)
  if p_order_item_id is not null then
    select src.result_user_ticket_id into v_designated
      from public.order_items oi
      join public.order_items src on src.id = oi.source_purchase_item_id
     where oi.id = p_order_item_id;
  end if;
  if v_designated is null then v_designated := p_user_ticket_id; end if;

  if v_designated is null then
    -- ② PERIOD 우선 → ③ COUNT 만료 임박 순
    select ut.* into v_ut
      from public.user_tickets ut
      join public.tickets t on t.id = ut.ticket_id
     where ut.user_id = v_user_id
       and coalesce(ut.status, 'ACTIVE') = 'ACTIVE'
       and (ut.fixed_class_id is null or ut.fixed_class_id = v_class.id)
       and (
         (ut.start_date is null and ut.expiry_date is null)          -- FIRST_BOOKING 미개시
         or ((ut.start_date is null or ut.start_date <= v_class_date)
             and (ut.expiry_date is null or ut.expiry_date >= v_class_date))
       )
       and (upper(t.ticket_type) = 'PERIOD' or coalesce(ut.remaining_count, 0) > 0)
       and public.booking_ticket_covers_class(t.id, v_class.id)
     order by (upper(t.ticket_type) = 'PERIOD') desc,
              coalesce(ut.expiry_date, '9999-12-31'::date) asc,
              ut.id asc
     limit 1;
    if not found then
      raise exception 'NO_USABLE_TICKET' using errcode = 'check_violation';
    end if;
  else
    select ut.* into v_ut from public.user_tickets ut
      where ut.id = v_designated and ut.user_id = v_user_id;
    if not found then
      raise exception 'USER_TICKET_NOT_FOUND' using errcode = 'no_data_found';
    end if;
  end if;

  select * into v_ticket from public.tickets where id = v_ut.ticket_id;

  -- ④(b) 고정 수업권은 그 수업에서만
  if v_ut.fixed_class_id is not null and v_ut.fixed_class_id <> v_class.id then
    raise exception 'FIXED_CLASS_MISMATCH' using errcode = 'check_violation';
  end if;

  -- ② 스페셜 수업: 명시적 커버(ticket_classes / ticket_coverage)만 허용
  if v_group_is_special then
    select exists(select 1 from public.ticket_classes tc
                   where tc.ticket_id = v_ticket.id and tc.class_id = v_class.id)
        or exists(select 1 from public.ticket_coverage tv
                   where tv.ticket_id = v_ticket.id and tv.is_active
                     and tv.class_group_id = v_class.class_group_id)
      into v_has_explicit;
    if not v_has_explicit then
      raise exception 'SPECIAL_CLASS_NOT_COVERED' using errcode = 'check_violation';
    end if;
  end if;

  -- ⑤ 커버리지 재검증
  v_covered := public.booking_ticket_covers_class(v_ticket.id, v_class.id);
  if not v_covered then
    raise exception 'TICKET_NOT_COVERED' using errcode = 'check_violation';
  end if;

  -- ⑥ 유효기간 — "예약일"이 아니라 "수업일(KST)" 기준
  if not (v_ut.start_date is null and v_ut.expiry_date is null) then
    if v_ut.start_date is not null and v_ut.start_date > v_class_date then
      raise exception 'TICKET_NOT_STARTED' using errcode = 'check_violation';
    end if;
    if v_ut.expiry_date is not null and v_ut.expiry_date < v_class_date then
      raise exception 'TICKET_EXPIRED' using errcode = 'check_violation';
    end if;
  end if;
  if coalesce(v_ut.status, 'ACTIVE') <> 'ACTIVE' then
    raise exception 'TICKET_NOT_ACTIVE' using errcode = 'check_violation';
  end if;

  -- ⑦ 중복 예약
  if exists (
    select 1 from public.bookings b
     where b.schedule_id = p_schedule_id
       and b.user_id = v_user_id
       and (b.status in ('CONFIRMED','COMPLETED')
            or (b.status = 'PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now()))
  ) then
    raise exception 'DUPLICATE_BOOKING' using errcode = 'unique_violation';
  end if;

  -- ⑧ 정원 — CONFIRMED + COMPLETED + 살아있는 PENDING 홀드
  v_cap := coalesce(v_sched.max_students, 2147483647);
  select count(*) into v_cur from public.bookings b
   where b.schedule_id = p_schedule_id
     and (b.status in ('CONFIRMED','COMPLETED')
          or (b.status = 'PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now()));
  if v_cur >= v_cap then
    raise exception 'SCHEDULE_FULL' using errcode = 'check_violation';
  end if;

  -- === 차감 ===
  if upper(coalesce(v_ticket.ticket_type, '')) = 'COUNT' then
    update public.user_tickets
       set remaining_count = remaining_count - 1,
           status = case when (remaining_count - 1) <= 0 then 'USED' else status end
     where id = v_ut.id
       and status = 'ACTIVE'
       and remaining_count is not null
       and remaining_count >= 1;
    if not found then
      raise exception 'INSUFFICIENT_TICKET_COUNT' using errcode = 'check_violation';
    end if;
    v_deducted := true;
  end if;

  -- FIRST_BOOKING: 최초 확정 예약 시 개시 (취소해도 되돌리지 않는다)
  if coalesce(v_ticket.start_mode, 'IMMEDIATE') = 'FIRST_BOOKING'
     and v_ut.start_date is null and v_ut.expiry_date is null then
    v_new_start := v_class_date;
    if v_ticket.valid_months is not null then
      v_new_expiry := public.kst_months_expiry(v_new_start, v_ticket.valid_months);
    elsif v_ticket.valid_days is not null then
      v_new_expiry := public.kst_inclusive_expiry(v_new_start, v_ticket.valid_days);
    else
      v_new_expiry := null;
    end if;
    update public.user_tickets
       set start_date = v_new_start, expiry_date = v_new_expiry
     where id = v_ut.id;
    v_started := true;
  end if;

  insert into public.bookings (user_id, class_id, schedule_id, user_ticket_id, status, payment_status)
  values (v_user_id, v_class.id, p_schedule_id, v_ut.id, 'CONFIRMED', 'PAID')
  returning * into v_booking;

  return jsonb_build_object(
    'ok', true,
    'booking_id', v_booking.id,
    'user_ticket_id', v_ut.id,
    'deducted', v_deducted,
    'ticket_started', v_started,
    'start_date', v_new_start,
    'expiry_date', v_new_expiry,
    'class_date', v_class_date
  );
end $$;

revoke all on function public.create_booking_tx(uuid, uuid, uuid, uuid) from public;
grant execute on function public.create_booking_tx(uuid, uuid, uuid, uuid) to authenticated, service_role;;