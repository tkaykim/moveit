-- T4-1: order_preflight() — 항목별 판정 단일 정본.
-- create_order_group 이 스케줄 락 아래에서 이 함수를 그대로 재호출한다(로직 중복 금지).
-- 클라이언트가 보낸 금액은 절대 읽지 않는다. 가격은 여기서만 계산된다.

create or replace function public.order_preflight(
  p_academy_id uuid,
  p_items jsonb,
  p_user_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_is_service boolean := public.booking_is_service_role();
  v_caller uuid := auth.uid();
  v_user_id uuid := p_user_id;
  v_today date := public.kst_date(now());
  v_n int;
  i int;
  v_item jsonb;
  v_type text;
  v_verdicts jsonb := '[]'::jsonb;
  v_code text;
  v_msg text;

  -- ticket purchase 로컬
  v_ticket record;
  v_opt jsonb;
  v_opt_idx int;
  v_price int;
  v_grant int;
  v_days int;
  v_fixed uuid;
  v_fixed_ok boolean;
  v_disc_mid uuid;
  v_disc_pct int;
  v_disc_amt int;

  -- schedule booking 로컬
  v_sched record;
  v_class record;
  v_policy jsonb;
  v_open timestamptz;
  v_close timestamptz;
  v_class_date date;
  v_link_idx int;
  v_link jsonb;
  v_link_ticket uuid;
  v_has_explicit boolean;
  v_usable boolean;
  v_owned_expired boolean;

  v_orig_total int := 0;
  v_disc_total int := 0;
begin
  if p_academy_id is null then
    raise exception 'ACADEMY_REQUIRED' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'ITEMS_MUST_BE_ARRAY' using errcode = 'check_violation';
  end if;

  -- 내부 권한 검사: 서비스롤 / 본인 / 학원 스태프 / 슈퍼관리자.
  -- 비로그인(게스트) 주문은 서버 라우트(서비스롤)만 조립할 수 있다.
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

  v_n := jsonb_array_length(p_items);
  if v_n = 0 then
    return jsonb_build_object('ok', true, 'items', '[]'::jsonb,
      'original_amount', 0, 'discount_amount', 0, 'total_amount', 0);
  end if;

  for i in 0 .. v_n - 1 loop
    v_item := p_items -> i;
    v_type := v_item ->> 'item_type';
    v_code := 'OK';
    v_msg := null;
    v_price := 0; v_grant := null; v_days := null;
    v_disc_mid := null; v_disc_pct := null; v_disc_amt := 0;
    v_ticket := null; v_opt_idx := null; v_fixed := null;

    if v_type = 'TICKET_PURCHASE' then
      select * into v_ticket from public.tickets where id = (v_item ->> 'ticket_id')::uuid;

      if not found then
        v_code := 'TICKET_NOT_FOUND'; v_msg := '수강권을 찾을 수 없습니다.';
      elsif v_ticket.academy_id is distinct from p_academy_id then
        v_code := 'TICKET_WRONG_ACADEMY'; v_msg := '이 학원의 상품이 아닙니다.';
      elsif coalesce(v_ticket.is_on_sale, false) = false then
        v_code := 'TICKET_NOT_ON_SALE'; v_msg := '현재 판매하지 않는 상품입니다.';
      else
        v_opt_idx := nullif(v_item ->> 'count_option_index', '')::int;

        if v_opt_idx is not null then
          v_opt := v_ticket.count_options -> v_opt_idx;
          if v_opt is null or jsonb_typeof(v_opt) <> 'object' then
            v_code := 'INVALID_COUNT_OPTION'; v_msg := '선택한 횟수 옵션이 존재하지 않습니다.';
          else
            v_price := coalesce((v_opt ->> 'price')::int, coalesce(v_ticket.price, 0));
            v_grant := coalesce((v_opt ->> 'count')::int, v_ticket.total_count);
            v_days  := coalesce((v_opt ->> 'valid_days')::int, v_ticket.valid_days);
          end if;
        else
          v_price := coalesce(v_ticket.price, 0);
          v_grant := v_ticket.total_count;
          v_days  := v_ticket.valid_days;
        end if;

        -- 고정 요일권은 어느 수업으로 고정할지 반드시 지정해야 한다
        if v_code = 'OK' and coalesce(v_ticket.is_fixed_weekly, false) then
          v_fixed := nullif(v_item ->> 'fixed_class_id', '')::uuid;
          if v_fixed is null then
            v_code := 'FIXED_CLASS_REQUIRED'; v_msg := '고정 수업을 선택해야 하는 상품입니다.';
          else
            select exists(
              select 1 from public.classes c
               where c.id = v_fixed and c.academy_id = p_academy_id
            ) into v_fixed_ok;
            if not v_fixed_ok then
              v_code := 'FIXED_CLASS_INVALID'; v_msg := '선택한 고정 수업이 올바르지 않습니다.';
            end if;
          end if;
        end if;

        -- 멤버십 할인: ACTIVE 멤버십의 is_active 규칙 중 최고 percent 하나만 (T3 규칙)
        if v_code = 'OK' and v_user_id is not null and v_price > 0 then
          select md.membership_id, md.percent into v_disc_mid, v_disc_pct
            from public.membership_discounts md
            join public.memberships m
              on m.id = md.membership_id and m.academy_id = p_academy_id
            join public.student_memberships sm
              on sm.membership_id = md.membership_id
             and sm.user_id = v_user_id
             and sm.status = 'ACTIVE'
             and sm.start_date <= v_today
             and (sm.end_date is null or sm.end_date >= v_today)
           where md.is_active
             and (
               md.ticket_id = v_ticket.id
               or (md.class_group_id is not null and exists (
                    select 1 from public.ticket_coverage tv
                     where tv.ticket_id = v_ticket.id and tv.is_active
                       and tv.class_group_id = md.class_group_id))
             )
           order by md.percent desc, md.id asc
           limit 1;

          if v_disc_pct is not null then
            v_disc_amt := floor((v_price * v_disc_pct) / 100.0)::int;
          else
            v_disc_mid := null;
          end if;
        end if;
      end if;

      v_verdicts := v_verdicts || jsonb_build_object(
        'index', i,
        'item_type', 'TICKET_PURCHASE',
        'ok', v_code = 'OK',
        'code', v_code,
        'message', coalesce(v_msg, '주문 가능합니다.'),
        'ticket_id', v_item ->> 'ticket_id',
        'count_option_index', v_opt_idx,
        'fixed_class_id', v_fixed,
        'ticket_name_snapshot', case when v_ticket is not null then v_ticket.name end,
        'ticket_type_snapshot', case when v_ticket is not null then v_ticket.ticket_type end,
        'grant_count_snapshot', v_grant,
        'valid_days_snapshot', v_days,
        'start_mode_snapshot', case when v_ticket is not null then v_ticket.start_mode end,
        'original_amount', case when v_code = 'OK' then v_price else 0 end,
        'discount_amount', case when v_code = 'OK' then v_disc_amt else 0 end,
        'final_amount', case when v_code = 'OK' then v_price - v_disc_amt else 0 end,
        'discount_membership_id', v_disc_mid,
        'discount_percent', v_disc_pct
      );

      if v_code = 'OK' then
        v_orig_total := v_orig_total + v_price;
        v_disc_total := v_disc_total + v_disc_amt;
      end if;

    elsif v_type = 'SCHEDULE_BOOKING' then
      v_link_idx := nullif(v_item ->> 'use_purchase_index', '')::int;
      v_link_ticket := null;

      select * into v_sched from public.schedules where id = (v_item ->> 'schedule_id')::uuid;

      if not found then
        v_code := 'SCHEDULE_NOT_FOUND'; v_msg := '스케줄 정보를 찾을 수 없습니다.';
      elsif v_sched.is_canceled then
        v_code := 'SCHEDULE_CANCELED'; v_msg := '취소된 수업에는 예약할 수 없습니다.';
      else
        select c.*, coalesce(g.is_special, false) as grp_special into v_class
          from public.classes c
          left join public.class_groups g on g.id = c.class_group_id
         where c.id = v_sched.class_id;

        if not found then
          v_code := 'SCHEDULE_NOT_FOUND'; v_msg := '클래스 정보를 찾을 수 없습니다.';
        elsif v_class.academy_id is distinct from p_academy_id then
          v_code := 'SCHEDULE_WRONG_ACADEMY'; v_msg := '이 학원의 수업이 아닙니다.';
        elsif v_class.class_group_id is null then
          v_code := 'CLASS_GROUP_MISSING'; v_msg := '수업 그룹이 지정되지 않아 예약할 수 없습니다.';
        else
          v_class_date := public.kst_date(v_sched.start_time);

          -- 대상 제한(멤버십 전용 수업)
          if v_code = 'OK' and v_class.audience_membership_id is not null then
            if v_user_id is null
               or not public.has_active_membership(v_user_id, v_class.audience_membership_id, v_class_date) then
              v_code := 'AUDIENCE_NOT_ELIGIBLE'; v_msg := '이 수업을 예약할 수 있는 대상이 아닙니다.';
            end if;
          end if;

          -- 예약 가능 시간대
          if v_code = 'OK' then
            select public.booking_resolve_policy(a.booking_policy, v_class.booking_policy) into v_policy
              from public.academies a where a.id = v_class.academy_id;
            v_policy := coalesce(v_policy, public.booking_resolve_policy(null, v_class.booking_policy));
            v_open := public.booking_open_at(v_sched.start_time, v_policy);
            v_close := public.booking_close_at(v_sched.start_time, v_policy);
            if v_open is not null and now() < v_open then
              v_code := 'BOOKING_NOT_YET_OPEN'; v_msg := '아직 예약 오픈 전입니다.';
            elsif now() >= v_close then
              v_code := 'BOOKING_CLOSED'; v_msg := '예약이 마감되었습니다.';
            end if;
          end if;

          -- 이미 예약함 (확정/완료 또는 살아있는 홀드)
          if v_code = 'OK' and v_user_id is not null then
            if exists (
              select 1 from public.bookings b
               where b.schedule_id = v_sched.id and b.user_id = v_user_id
                 and (b.status in ('CONFIRMED','COMPLETED')
                      or (b.status = 'PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now()))
            ) then
              v_code := 'DUPLICATE_BOOKING'; v_msg := '이미 예약된 수업입니다.';
            end if;
          end if;

          -- 같은 장바구니 안 중복
          if v_code = 'OK' then
            if exists (
              select 1 from jsonb_array_elements(p_items) with ordinality as e(el, ord)
               where e.ord - 1 < i
                 and e.el ->> 'item_type' = 'SCHEDULE_BOOKING'
                 and e.el ->> 'schedule_id' = v_sched.id::text
            ) then
              v_code := 'DUPLICATE_IN_CART'; v_msg := '같은 수업이 장바구니에 중복되어 있습니다.';
            end if;
          end if;

          -- 정원 (살아있는 홀드 포함 — 트리거와 동일 기준)
          if v_code = 'OK' then
            if (select count(*) from public.bookings b
                 where b.schedule_id = v_sched.id
                   and (b.status in ('CONFIRMED','COMPLETED')
                        or (b.status = 'PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now())))
               >= coalesce(v_sched.max_students, 2147483647) then
              v_code := 'SCHEDULE_FULL'; v_msg := '정원이 마감되었습니다.';
            end if;
          end if;

          -- 이 예약을 무엇으로 결제하는가:
          --  (a) 같은 장바구니의 수강권 구매 항목과 연결 → 그 상품의 커버리지로 판정
          --  (b) 연결이 없으면 이미 보유한 수강권 중 사용 가능한 것이 있어야 한다
          if v_code = 'OK' and v_link_idx is not null then
            v_link := p_items -> v_link_idx;
            if v_link is null
               or v_link ->> 'item_type' <> 'TICKET_PURCHASE'
               or v_link_idx = i then
              v_code := 'INVALID_PURCHASE_LINK'; v_msg := '연결한 수강권 구매 항목이 올바르지 않습니다.';
            else
              v_link_ticket := (v_link ->> 'ticket_id')::uuid;
              if v_class.grp_special then
                select exists(select 1 from public.ticket_classes tc
                               where tc.ticket_id = v_link_ticket and tc.class_id = v_class.id)
                    or exists(select 1 from public.ticket_coverage tv
                               where tv.ticket_id = v_link_ticket and tv.is_active
                                 and tv.class_group_id = v_class.class_group_id)
                  into v_has_explicit;
                if not v_has_explicit then
                  v_code := 'SPECIAL_CLASS_NOT_COVERED';
                  v_msg := '보유하신 수강권으로는 예약할 수 없는 수업입니다.';
                end if;
              end if;
              if v_code = 'OK' and not public.booking_ticket_covers_class(v_link_ticket, v_class.id) then
                v_code := 'TICKET_NOT_COVERED'; v_msg := '이 수업에 사용할 수 없는 수강권입니다.';
              end if;
            end if;

          elsif v_code = 'OK' then
            v_usable := false; v_owned_expired := false;

            if v_user_id is not null then
              select exists (
                select 1 from public.user_tickets ut
                  join public.tickets t on t.id = ut.ticket_id
                 where ut.user_id = v_user_id and coalesce(ut.status,'ACTIVE') = 'ACTIVE'
                   and (ut.fixed_class_id is null or ut.fixed_class_id = v_class.id)
                   and ((ut.start_date is null and ut.expiry_date is null)
                        or ((ut.start_date is null or ut.start_date <= v_class_date)
                            and (ut.expiry_date is null or ut.expiry_date >= v_class_date)))
                   and (upper(t.ticket_type) = 'PERIOD' or coalesce(ut.remaining_count,0) > 0)
                   and public.booking_ticket_covers_class(t.id, v_class.id)
              ) into v_usable;

              if not v_usable then
                -- 커버는 하지만 수업일 기준으로 만료된 권이 있는가 (사유를 구분해 알려준다)
                select exists (
                  select 1 from public.user_tickets ut
                    join public.tickets t on t.id = ut.ticket_id
                   where ut.user_id = v_user_id
                     and public.booking_ticket_covers_class(t.id, v_class.id)
                     and ut.expiry_date is not null and ut.expiry_date < v_class_date
                ) into v_owned_expired;
              end if;
            end if;

            if not v_usable then
              if v_owned_expired then
                v_code := 'TICKET_EXPIRED'; v_msg := '수업일 기준으로 만료된 수강권입니다.';
              elsif v_class.grp_special then
                v_code := 'SPECIAL_CLASS_NOT_COVERED';
                v_msg := '보유하신 수강권으로는 예약할 수 없는 수업입니다.';
              else
                v_code := 'NO_USABLE_TICKET'; v_msg := '이 수업에 사용 가능한 수강권이 없습니다.';
              end if;
            end if;
          end if;
        end if;
      end if;

      -- 예약 항목 자체는 무료다. 금액은 수강권 구매 항목에서만 발생한다.
      v_verdicts := v_verdicts || jsonb_build_object(
        'index', i,
        'item_type', 'SCHEDULE_BOOKING',
        'ok', v_code = 'OK',
        'code', v_code,
        'message', coalesce(v_msg, '주문 가능합니다.'),
        'schedule_id', v_item ->> 'schedule_id',
        'class_id', case when v_class is not null then v_class.id end,
        'use_purchase_index', v_link_idx,
        'original_amount', 0,
        'discount_amount', 0,
        'final_amount', 0,
        'discount_membership_id', null,
        'discount_percent', null
      );

    else
      v_verdicts := v_verdicts || jsonb_build_object(
        'index', i,
        'item_type', v_type,
        'ok', false,
        'code', 'INVALID_ITEM_TYPE',
        'message', '알 수 없는 주문 항목 유형입니다.',
        'original_amount', 0, 'discount_amount', 0, 'final_amount', 0,
        'discount_membership_id', null, 'discount_percent', null
      );
    end if;
  end loop;

  return jsonb_build_object(
    'ok', not exists (select 1 from jsonb_array_elements(v_verdicts) v where (v.value ->> 'ok')::boolean = false),
    'items', v_verdicts,
    'original_amount', v_orig_total,
    'discount_amount', v_disc_total,
    'total_amount', v_orig_total - v_disc_total
  );
end $function$;

revoke all on function public.order_preflight(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.order_preflight(uuid, jsonb, uuid) to authenticated, service_role;;