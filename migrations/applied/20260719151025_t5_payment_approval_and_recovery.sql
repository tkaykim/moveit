-- =====================================================================
-- T5: 승인 기록 · 이행 실패 기록 · 막힌 주문 조회
-- =====================================================================

-- ① 결제 승인 기록 (이행 전). 승인은 여기서 **먼저 커밋**되므로,
--    뒤이은 이행이 실패해도 "결제됐다"는 사실은 절대 사라지지 않는다.
create or replace function public.record_order_payment_approval(
  p_order_group_id uuid,
  p_approved_amount integer,
  p_payment_key text default null,
  p_expected_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_og public.order_groups;
begin
  if not public.booking_is_service_role() then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  -- 만료 스윕과 같은 행 락을 잡는다 → 확정과 만료 중 정확히 하나만 이긴다.
  select * into v_og from public.order_groups where id = p_order_group_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if p_expected_method is not null and v_og.method <> p_expected_method then
    raise exception 'ORDER_METHOD_MISMATCH:%:%', v_og.method, p_expected_method
      using errcode = 'check_violation';
  end if;

  -- 이미 확정된 주문에 대한 두 번째 승인 → 아무것도 하지 않는다 (중복 승인 멱등).
  if v_og.status = 'CONFIRMED' then
    return jsonb_build_object('ok', true, 'already_confirmed', true,
      'order_group_id', v_og.id, 'status', v_og.status);
  end if;

  if v_og.status not in ('PENDING_PAYMENT', 'PAYMENT_APPROVED', 'FULFILLMENT_FAILED') then
    -- EXPIRED / CANCELED 주문은 승인될 수 없다. 만료 스윕이 이겼다는 뜻.
    raise exception 'ORDER_NOT_APPROVABLE:%', v_og.status using errcode = 'check_violation';
  end if;

  -- ⚠ 승인 금액 ≠ 주문 총액 이면 이행하지 않는다.
  if p_approved_amount is null or p_approved_amount <> v_og.total_amount then
    raise exception 'ORDER_AMOUNT_MISMATCH:%:%', v_og.total_amount, coalesce(p_approved_amount, -1)
      using errcode = 'check_violation';
  end if;

  update public.order_groups
     set status = 'PAYMENT_APPROVED',
         payment_key = coalesce(payment_key, p_payment_key),
         payment_approved_at = coalesce(payment_approved_at, now()),
         updated_at = now()
   where id = v_og.id;

  return jsonb_build_object('ok', true, 'already_confirmed', false,
    'order_group_id', v_og.id, 'status', 'PAYMENT_APPROVED',
    'total_amount', v_og.total_amount);
end $$;

revoke all on function public.record_order_payment_approval(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.record_order_payment_approval(uuid, integer, text, text) to service_role;


-- ② 이행 실패 기록. finalize 가 롤백된 **뒤** 별도 트랜잭션에서 호출된다.
create or replace function public.mark_order_fulfillment_failed(
  p_order_group_id uuid,
  p_error_code text,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_og public.order_groups;
begin
  if not public.booking_is_service_role() then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_og from public.order_groups where id = p_order_group_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- 성공을 실패로 덮어쓰지 않는다.
  if v_og.status = 'CONFIRMED' then
    return jsonb_build_object('ok', true, 'recorded', false, 'status', 'CONFIRMED');
  end if;

  update public.order_groups
     set status = 'FULFILLMENT_FAILED',
         fulfillment_error_code = left(coalesce(p_error_code, 'UNKNOWN'), 200),
         fulfillment_error_message = left(coalesce(p_error_message, ''), 2000),
         retry_count = retry_count + 1,
         updated_at = now()
   where id = v_og.id;

  return jsonb_build_object('ok', true, 'recorded', true,
    'order_group_id', v_og.id, 'status', 'FULFILLMENT_FAILED',
    'retry_count', v_og.retry_count + 1);
end $$;

revoke all on function public.mark_order_fulfillment_failed(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.mark_order_fulfillment_failed(uuid, text, text) to service_role;


-- ③ 막힌 주문 조회 — 결제는 됐는데 이행이 안 끝난 것들 (운영 대시보드용 데이터 소스).
create or replace function public.list_stuck_orders(
  p_academy_id uuid default null,
  p_limit integer default 200
)
returns table (
  order_group_id uuid,
  academy_id uuid,
  user_id uuid,
  method text,
  status text,
  total_amount integer,
  provider_order_id text,
  payment_key text,
  payment_approved_at timestamptz,
  fulfillment_error_code text,
  fulfillment_error_message text,
  retry_count integer,
  orderer_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select og.id, og.academy_id, og.user_id, og.method, og.status, og.total_amount,
         og.provider_order_id, og.payment_key, og.payment_approved_at,
         og.fulfillment_error_code, og.fulfillment_error_message, og.retry_count,
         og.orderer_name, og.created_at
    from public.order_groups og
   where og.status in ('PAYMENT_APPROVED', 'FULFILLMENT_FAILED')
     and (p_academy_id is null or og.academy_id = p_academy_id)
     and (public.booking_is_service_role()
          or public.is_academy_staff(og.academy_id)
          or public.is_super_admin())
   order by og.payment_approved_at asc nulls last, og.created_at asc
   limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

revoke all on function public.list_stuck_orders(uuid, integer) from public, anon;
grant execute on function public.list_stuck_orders(uuid, integer) to service_role, authenticated;;