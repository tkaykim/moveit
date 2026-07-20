-- =====================================================================
-- T5: finalize_order_group — BANK / TOSS / ONSITE 가 **똑같이** 쓰는 단일 이행 경로
--
-- 외부 PG 승인과 내부 이행은 한 트랜잭션이 될 수 없다. 그래서 주문 상태기계에
-- "결제는 됐는데 아직 이행 전"(PAYMENT_APPROVED)이 존재한다.
-- 이 함수는 **이행만** 한 트랜잭션으로 처리한다. 한 항목이라도 실패하면 전부 롤백되고,
-- 호출자가 별도 트랜잭션에서 FULFILLMENT_FAILED 를 기록한다 (승인이 조용히 사라지지 않는다).
-- =====================================================================
create or replace function public.finalize_order_group(
  p_order_group_id uuid,
  p_confirmed_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_og public.order_groups;
  v_sum int;
  v_conf_date date;
  v_it record;
  v_t_type text;
  v_start date; v_expiry date;
  v_ut_id uuid;
  v_ut public.user_tickets;
  v_sched record;
  v_class record;
  v_class_date date;
  v_booking_id uuid;
  v_cap int; v_cur int;
  v_tk_type text;
  v_vd int; v_vm int;
  v_found boolean;
  v_tickets jsonb := '[]'::jsonb;
  v_bookings jsonb := '[]'::jsonb;
  v_promoted int := 0;
  v_created int := 0;
begin
  -- ① 주문 행 잠금. 확정·만료·재시도가 모두 이 락 하나로 직렬화된다.
  select * into v_og from public.order_groups where id = p_order_group_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not (public.booking_is_service_role()
          or public.is_academy_staff(v_og.academy_id)
          or public.is_super_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  -- ② 이미 확정 → 아무것도 더 만들지 않고 기존 결과를 그대로 돌려준다 (멱등).
  if v_og.status = 'CONFIRMED' then
    return jsonb_build_object(
      'ok', true, 'idempotent', true,
      'order_group_id', v_og.id, 'status', 'CONFIRMED',
      'confirmed_at', v_og.confirmed_at,
      'user_ticket_ids', (
        select coalesce(jsonb_agg(oi.result_user_ticket_id order by oi.created_at), '[]'::jsonb)
          from public.order_items oi
         where oi.order_group_id = v_og.id and oi.result_user_ticket_id is not null),
      'booking_ids', (
        select coalesce(jsonb_agg(oi.result_booking_id order by oi.created_at), '[]'::jsonb)
          from public.order_items oi
         where oi.order_group_id = v_og.id and oi.result_booking_id is not null),
      'issued_tickets', 0, 'created_bookings', 0, 'promoted_holds', 0
    );
  end if;

  if v_og.status not in ('PENDING_PAYMENT', 'PAYMENT_APPROVED', 'FULFILLMENT_FAILED') then
    raise exception 'ORDER_NOT_FULFILLABLE:%', v_og.status using errcode = 'check_violation';
  end if;

  -- ③ 금액 재검증: 항목 합계 = 주문 총액.
  select coalesce(sum(final_amount), 0) into v_sum
    from public.order_items where order_group_id = v_og.id;
  if v_sum <> v_og.total_amount then
    raise exception 'ORDER_AMOUNT_MISMATCH:%:%', v_og.total_amount, v_sum
      using errcode = 'check_violation';
  end if;

  if v_og.user_id is null then
    -- user_tickets.user_id 는 NOT NULL 이다. 게스트 주문은 회원 연결 후에만 이행 가능.
    raise exception 'GUEST_FULFILLMENT_UNSUPPORTED' using errcode = 'check_violation';
  end if;

  -- BANK 의 확정일 = 입금 확인일. 1일권 쿠폰의 유효일이 여기서 정해진다.
  v_conf_date := public.kst_date(now());

  -- =========================================================
  -- ④ 수강권 발급 — **오직 스냅샷만** 본다 (현재 tickets 행을 읽지 않는다).
  -- =========================================================
  for v_it in
    select * from public.order_items
     where order_group_id = v_og.id and item_type = 'TICKET_PURCHASE'
     order by created_at, id
  loop
    if v_it.result_user_ticket_id is not null then
      v_tickets := v_tickets || to_jsonb(v_it.result_user_ticket_id);
      continue; -- 이미 발급됨 (재시도) → 중복 발급 금지
    end if;

    v_t_type := upper(coalesce(v_it.ticket_type_snapshot, ''));

    if coalesce(v_it.is_coupon_snapshot, false) and coalesce(v_it.valid_days_snapshot, 0) = 1 then
      -- 1일 쿠폰: 시작 = 만료 = 확정일(KST). BANK 는 주문일이 아니라 입금 확인일.
      v_start := v_conf_date;
      v_expiry := v_conf_date;
    elsif coalesce(v_it.start_mode_snapshot, 'IMMEDIATE') = 'FIRST_BOOKING' then
      -- 첫 예약에 개시 → 발급 시점엔 기간이 정해지지 않는다.
      v_start := null;
      v_expiry := null;
    else
      v_start := v_conf_date;
      if v_it.valid_months_snapshot is not null then
        v_expiry := public.kst_months_expiry(v_start, v_it.valid_months_snapshot);
      elsif v_it.valid_days_snapshot is not null then
        v_expiry := public.kst_inclusive_expiry(v_start, v_it.valid_days_snapshot);
      else
        v_expiry := null;
      end if;
    end if;

    insert into public.user_tickets (
      user_id, ticket_id, remaining_count, start_date, expiry_date, status, fixed_class_id
    ) values (
      v_og.user_id, v_it.ticket_id,
      case when v_t_type = 'PERIOD' then 0 else coalesce(v_it.grant_count_snapshot, 0) end,
      v_start, v_expiry, 'ACTIVE', v_it.fixed_class_id
    ) returning id into v_ut_id;

    update public.order_items set result_user_ticket_id = v_ut_id where id = v_it.id;

    -- 매출은 항목당 정확히 한 줄 (order_item_id 유니크 인덱스가 물리적으로 보장).
    insert into public.revenue_transactions (
      academy_id, user_id, ticket_id, user_ticket_id,
      original_price, discount_amount, final_price,
      payment_method, payment_status, transaction_date,
      quantity, valid_days, ticket_name, ticket_type_snapshot,
      toss_payment_key, toss_order_id, actor_user_id,
      order_group_id, order_item_id
    ) values (
      v_og.academy_id, v_og.user_id, v_it.ticket_id, v_ut_id,
      v_it.original_amount, v_it.discount_amount, v_it.final_amount,
      v_og.method, 'COMPLETED', now(),
      1, v_it.valid_days_snapshot, v_it.ticket_name_snapshot, v_it.ticket_type_snapshot,
      v_og.payment_key, v_og.provider_order_id, p_confirmed_by,
      v_og.id, v_it.id
    )
    on conflict (order_item_id) where order_item_id is not null do nothing;

    v_tickets := v_tickets || to_jsonb(v_ut_id);
  end loop;

  -- =========================================================
  -- ⑤ 좌석 확정
  --    BANK  : 기존 PENDING 홀드를 CONFIRMED 로 **승격** (새로 만들면 이중예약)
  --    TOSS/ONSITE : 지금 생성 + 정원 재검증
  -- =========================================================
  for v_it in
    select * from public.order_items
     where order_group_id = v_og.id and item_type = 'SCHEDULE_BOOKING'
     order by created_at, id
  loop
    select * into v_sched from public.schedules where id = v_it.schedule_id for update;
    if not found then
      raise exception 'SCHEDULE_NOT_FOUND:%', v_it.schedule_id using errcode = 'no_data_found';
    end if;
    if v_sched.is_canceled then
      raise exception 'SCHEDULE_CANCELED:%', v_it.schedule_id using errcode = 'check_violation';
    end if;

    v_class_date := public.kst_date(v_sched.start_time);
    select c.* into v_class from public.classes c where c.id = v_sched.class_id;
    if not found then
      raise exception 'CLASS_NOT_FOUND:%', v_it.schedule_id using errcode = 'no_data_found';
    end if;

    -- 사용할 수강권: 같은 주문의 구매 항목 지정이 최우선 ("사서 바로 쓴다").
    v_ut_id := null;
    if v_it.source_purchase_item_id is not null then
      select result_user_ticket_id into v_ut_id
        from public.order_items where id = v_it.source_purchase_item_id;
      if v_ut_id is null then
        raise exception 'PURCHASE_ITEM_NOT_ISSUED:%', v_it.source_purchase_item_id
          using errcode = 'check_violation';
      end if;
    end if;

    if v_ut_id is null then
      select ut.id into v_ut_id
        from public.user_tickets ut
        join public.tickets t on t.id = ut.ticket_id
       where ut.user_id = v_og.user_id and coalesce(ut.status, 'ACTIVE') = 'ACTIVE'
         and (ut.fixed_class_id is null or ut.fixed_class_id = v_class.id)
         and ((ut.start_date is null and ut.expiry_date is null)
              or ((ut.start_date is null or ut.start_date <= v_class_date)
                  and (ut.expiry_date is null or ut.expiry_date >= v_class_date)))
         and (upper(t.ticket_type) = 'PERIOD' or coalesce(ut.remaining_count, 0) > 0)
         and public.booking_ticket_covers_class(t.id, v_class.id)
       order by (upper(t.ticket_type) = 'PERIOD') desc,
                coalesce(ut.expiry_date, '9999-12-31'::date) asc, ut.id asc
       limit 1;
      if v_ut_id is null then
        raise exception 'NO_USABLE_TICKET:%', v_it.schedule_id using errcode = 'check_violation';
      end if;
    end if;

    select * into v_ut from public.user_tickets where id = v_ut_id for update;
    if not found or v_ut.user_id is distinct from v_og.user_id then
      raise exception 'USER_TICKET_NOT_FOUND:%', v_ut_id using errcode = 'no_data_found';
    end if;
    if coalesce(v_ut.status, 'ACTIVE') <> 'ACTIVE' then
      raise exception 'TICKET_NOT_ACTIVE:%', v_ut_id using errcode = 'check_violation';
    end if;
    if v_ut.fixed_class_id is not null and v_ut.fixed_class_id <> v_class.id then
      raise exception 'FIXED_CLASS_MISMATCH:%', v_it.schedule_id using errcode = 'check_violation';
    end if;
    if not public.booking_ticket_covers_class(v_ut.ticket_id, v_class.id) then
      raise exception 'TICKET_NOT_COVERED:%', v_it.schedule_id using errcode = 'check_violation';
    end if;
    if v_ut.start_date is not null and v_ut.start_date > v_class_date then
      raise exception 'TICKET_NOT_STARTED:%', v_it.schedule_id using errcode = 'check_violation';
    end if;
    if v_ut.expiry_date is not null and v_ut.expiry_date < v_class_date then
      raise exception 'TICKET_EXPIRED:%', v_it.schedule_id using errcode = 'check_violation';
    end if;

    -- BANK 홀드가 있으면 그것을 승격한다. 없으면(TOSS/ONSITE) 새로 만든다.
    v_booking_id := null;
    if v_it.result_booking_id is not null then
      select b.id into v_booking_id from public.bookings b
       where b.id = v_it.result_booking_id and b.status = 'PENDING' for update;
    end if;

    -- 정원 재검증 (자기 홀드는 이미 세어져 있으므로 제외하고 센다)
    v_cap := coalesce(v_sched.max_students, 2147483647);
    select count(*) into v_cur from public.bookings b
     where b.schedule_id = v_sched.id
       and (v_booking_id is null or b.id <> v_booking_id)
       and (b.status in ('CONFIRMED', 'COMPLETED')
            or (b.status = 'PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now()));
    if v_cur >= v_cap then
      raise exception 'SCHEDULE_FULL:%', v_it.schedule_id using errcode = 'check_violation';
    end if;

    if exists (
      select 1 from public.bookings b
       where b.schedule_id = v_sched.id and b.user_id = v_og.user_id
         and (v_booking_id is null or b.id <> v_booking_id)
         and b.status in ('CONFIRMED', 'COMPLETED')
    ) then
      raise exception 'DUPLICATE_BOOKING:%', v_it.schedule_id using errcode = 'unique_violation';
    end if;

    -- 횟수 차감은 예약 1건당 정확히 한 번.
    select upper(coalesce(t.ticket_type, '')) into v_tk_type
      from public.tickets t where t.id = v_ut.ticket_id;

    if v_tk_type = 'COUNT' then
      update public.user_tickets
         set remaining_count = remaining_count - 1,
             status = case when (remaining_count - 1) <= 0 then 'USED' else status end
       where id = v_ut.id and status = 'ACTIVE'
         and remaining_count is not null and remaining_count >= 1;
      if not found then
        raise exception 'INSUFFICIENT_TICKET_COUNT:%', v_it.schedule_id using errcode = 'check_violation';
      end if;
    end if;

    -- FIRST_BOOKING: 이 예약이 첫 사용 → 여기서 기간이 개시된다.
    if v_ut.start_date is null and v_ut.expiry_date is null then
      select oi.valid_days_snapshot, oi.valid_months_snapshot into v_vd, v_vm
        from public.order_items oi where oi.result_user_ticket_id = v_ut.id limit 1;
      v_found := found;
      if not v_found then
        select t.valid_days, t.valid_months into v_vd, v_vm
          from public.tickets t where t.id = v_ut.ticket_id;
      end if;
      if v_vm is not null then
        v_expiry := public.kst_months_expiry(v_class_date, v_vm);
      elsif v_vd is not null then
        v_expiry := public.kst_inclusive_expiry(v_class_date, v_vd);
      else
        v_expiry := null;
      end if;
      update public.user_tickets
         set start_date = v_class_date, expiry_date = v_expiry
       where id = v_ut.id;
    end if;

    if v_booking_id is not null then
      update public.bookings
         set status = 'CONFIRMED', payment_status = 'PAID',
             user_ticket_id = v_ut.id, hold_expires_at = null,
             class_id = coalesce(class_id, v_class.id)
       where id = v_booking_id;
      v_promoted := v_promoted + 1;
    else
      insert into public.bookings (
        user_id, class_id, schedule_id, user_ticket_id, status, payment_status, order_group_id
      ) values (
        v_og.user_id, v_class.id, v_sched.id, v_ut.id, 'CONFIRMED', 'PAID', v_og.id
      ) returning id into v_booking_id;
      v_created := v_created + 1;
    end if;

    update public.order_items set result_booking_id = v_booking_id where id = v_it.id;
    v_bookings := v_bookings || to_jsonb(v_booking_id);
  end loop;

  -- ⑥ 확정
  update public.order_groups
     set status = 'CONFIRMED',
         confirmed_at = now(),
         confirmed_by = p_confirmed_by,
         fulfillment_error_code = null,
         fulfillment_error_message = null,
         updated_at = now()
   where id = v_og.id;

  return jsonb_build_object(
    'ok', true, 'idempotent', false,
    'order_group_id', v_og.id, 'status', 'CONFIRMED',
    'user_ticket_ids', v_tickets,
    'booking_ids', v_bookings,
    'issued_tickets', jsonb_array_length(v_tickets),
    'created_bookings', v_created,
    'promoted_holds', v_promoted,
    'confirmed_date_kst', v_conf_date
  );
end $$;

revoke all on function public.finalize_order_group(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_order_group(uuid, uuid) to service_role;;