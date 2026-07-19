-- T4-2: create_order_group() — 단일 트랜잭션으로 주문 조립.
-- 재검증(preflight 결과 신뢰 금지) → order_groups + order_items 삽입 →
-- BANK 이면 좌석을 잡는 PENDING bookings(hold_expires_at = now()+24h) 까지 같은 트랜잭션.

create or replace function public.create_order_group(
  p_academy_id uuid,
  p_method text,
  p_provider_order_id text,
  p_items jsonb,
  p_user_id uuid default null,
  p_orderer jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_is_service boolean := public.booking_is_service_role();
  v_caller uuid := auth.uid();
  v_user_id uuid := p_user_id;
  v_existing public.order_groups;
  v_pre jsonb;
  v_v jsonb;
  v_bad jsonb;
  v_og public.order_groups;
  v_hold_until timestamptz;
  v_expires timestamptz;
  i int;
  v_item jsonb;
  v_item_ids uuid[] := '{}';
  v_new_item public.order_items;
  v_link_idx int;
  v_src uuid;
  v_booking_id uuid;
  v_bookings jsonb := '[]'::jsonb;
begin
  if p_method not in ('BANK','TOSS','ONSITE') then
    raise exception 'INVALID_METHOD' using errcode = 'check_violation';
  end if;
  if p_provider_order_id is null or btrim(p_provider_order_id) = '' then
    raise exception 'PROVIDER_ORDER_ID_REQUIRED' using errcode = 'check_violation';
  end if;

  -- 권한: 서비스롤 / 본인 / 학원 스태프 / 슈퍼관리자. 게스트(null)는 서비스롤만.
  if not v_is_service then
    if v_user_id is null then
      raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
    end if;
    if not (v_caller = v_user_id
            or public.is_academy_staff(p_academy_id)
            or public.is_super_admin()) then
      raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- 멱등: 같은 provider_order_id 는 언제나 같은 주문 하나.
  select * into v_existing from public.order_groups where provider_order_id = p_provider_order_id;
  if found then
    return jsonb_build_object('ok', true, 'idempotent', true,
      'order_group_id', v_existing.id, 'status', v_existing.status,
      'total_amount', v_existing.total_amount);
  end if;

  -- 마지막 좌석 경합: 관련 스케줄을 **id 오름차순**으로 잠가 데드락 없이 승자를 하나로 만든다.
  perform 1 from public.schedules s
   where s.id in (
     select distinct (e.el ->> 'schedule_id')::uuid
       from jsonb_array_elements(p_items) as e(el)
      where e.el ->> 'item_type' = 'SCHEDULE_BOOKING'
        and nullif(e.el ->> 'schedule_id','') is not null
   )
   order by s.id
   for update;

  -- 락 아래에서 전 항목 재검증 (preflight 결과는 신뢰하지 않는다)
  v_pre := public.order_preflight(p_academy_id, p_items, v_user_id);

  select v.value into v_bad
    from jsonb_array_elements(v_pre -> 'items') v
   where (v.value ->> 'ok')::boolean = false
   limit 1;

  if v_bad is not null then
    raise exception 'ORDER_ITEM_REJECTED:%:%', (v_bad ->> 'index'), (v_bad ->> 'code')
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(v_pre -> 'items') = 0 then
    raise exception 'EMPTY_ORDER' using errcode = 'check_violation';
  end if;

  if p_method = 'BANK' then
    v_hold_until := now() + interval '24 hours';
    v_expires := v_hold_until;
  end if;

  insert into public.order_groups (
    academy_id, user_id, method, status, original_amount, discount_amount, total_amount,
    provider_order_id, expires_at, orderer_name, orderer_phone, orderer_email
  ) values (
    p_academy_id, v_user_id, p_method, 'PENDING_PAYMENT',
    (v_pre ->> 'original_amount')::int,
    (v_pre ->> 'discount_amount')::int,
    (v_pre ->> 'total_amount')::int,
    p_provider_order_id, v_expires,
    p_orderer ->> 'name', p_orderer ->> 'phone', p_orderer ->> 'email'
  ) returning * into v_og;

  -- 항목: 판정 결과(=서버가 계산한 가격)를 그대로 스냅샷한다.
  for i in 0 .. jsonb_array_length(v_pre -> 'items') - 1 loop
    v_v := (v_pre -> 'items') -> i;

    insert into public.order_items (
      order_group_id, item_type, ticket_id, schedule_id, class_id, fixed_class_id,
      count_option_index, ticket_name_snapshot, ticket_type_snapshot,
      grant_count_snapshot, valid_days_snapshot, start_mode_snapshot,
      original_amount, discount_amount, final_amount,
      discount_membership_id, discount_percent
    ) values (
      v_og.id,
      v_v ->> 'item_type',
      nullif(v_v ->> 'ticket_id','')::uuid,
      nullif(v_v ->> 'schedule_id','')::uuid,
      nullif(v_v ->> 'class_id','')::uuid,
      nullif(v_v ->> 'fixed_class_id','')::uuid,
      nullif(v_v ->> 'count_option_index','')::int,
      v_v ->> 'ticket_name_snapshot',
      v_v ->> 'ticket_type_snapshot',
      nullif(v_v ->> 'grant_count_snapshot','')::int,
      nullif(v_v ->> 'valid_days_snapshot','')::int,
      v_v ->> 'start_mode_snapshot',
      (v_v ->> 'original_amount')::int,
      (v_v ->> 'discount_amount')::int,
      (v_v ->> 'final_amount')::int,
      nullif(v_v ->> 'discount_membership_id','')::uuid,
      nullif(v_v ->> 'discount_percent','')::int
    ) returning * into v_new_item;

    v_item_ids := v_item_ids || v_new_item.id;
  end loop;

  -- "사서 바로 쓴다" 링크: 예약 항목 → 그 결제에 쓸 구매 항목.
  -- T2 selection 이 이 지정을 그대로 따른다(선택 로직 재구현 금지).
  for i in 0 .. jsonb_array_length(v_pre -> 'items') - 1 loop
    v_v := (v_pre -> 'items') -> i;
    if v_v ->> 'item_type' = 'SCHEDULE_BOOKING' then
      v_link_idx := nullif(v_v ->> 'use_purchase_index','')::int;
      if v_link_idx is not null then
        v_src := v_item_ids[v_link_idx + 1];
        update public.order_items set source_purchase_item_id = v_src
         where id = v_item_ids[i + 1];
      end if;
    end if;
  end loop;

  -- BANK: 24시간 입금 대기 동안 좌석을 실제로 점유한다.
  -- (정원 트리거가 살아있는 홀드를 세므로 다른 학생이 그 자리를 가져갈 수 없다)
  if p_method = 'BANK' then
    for i in 0 .. jsonb_array_length(v_pre -> 'items') - 1 loop
      v_v := (v_pre -> 'items') -> i;
      if v_v ->> 'item_type' = 'SCHEDULE_BOOKING' then
        insert into public.bookings (
          user_id, class_id, schedule_id, status, payment_status,
          order_group_id, hold_expires_at, guest_name, guest_phone, guest_email
        ) values (
          v_user_id,
          (v_v ->> 'class_id')::uuid,
          (v_v ->> 'schedule_id')::uuid,
          'PENDING', 'PENDING',
          v_og.id, v_hold_until,
          case when v_user_id is null then p_orderer ->> 'name' end,
          case when v_user_id is null then p_orderer ->> 'phone' end,
          case when v_user_id is null then p_orderer ->> 'email' end
        ) returning id into v_booking_id;

        update public.order_items set result_booking_id = v_booking_id
         where id = v_item_ids[i + 1];

        v_bookings := v_bookings || to_jsonb(v_booking_id);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true, 'idempotent', false,
    'order_group_id', v_og.id,
    'provider_order_id', v_og.provider_order_id,
    'status', v_og.status,
    'method', v_og.method,
    'original_amount', v_og.original_amount,
    'discount_amount', v_og.discount_amount,
    'total_amount', v_og.total_amount,
    'expires_at', v_og.expires_at,
    'order_item_ids', to_jsonb(v_item_ids),
    'hold_booking_ids', v_bookings
  );

exception
  when unique_violation then
    -- 더블클릭 경합: 진 쪽은 이긴 쪽의 주문을 그대로 돌려준다.
    select * into v_existing from public.order_groups where provider_order_id = p_provider_order_id;
    if found then
      return jsonb_build_object('ok', true, 'idempotent', true,
        'order_group_id', v_existing.id, 'status', v_existing.status,
        'total_amount', v_existing.total_amount);
    end if;
    raise;
end $function$;

revoke all on function public.create_order_group(uuid, text, text, jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_order_group(uuid, text, text, jsonb, uuid, jsonb) to authenticated, service_role;;