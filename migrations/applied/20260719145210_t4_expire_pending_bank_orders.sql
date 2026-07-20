-- T4-3: 24시간 입금 대기 만료 스윕.
-- PENDING_PAYMENT + BANK + expires_at 경과 → EXPIRED, 물고 있던 PENDING 홀드는 CANCELLED(L 두 개).
-- 결제 확정과 경합하므로 주문 행을 반드시 잠그고, 잠근 뒤 상태를 다시 본다.
-- 이미 CONFIRMED 로 넘어간 주문은 절대 건드리지 않는다. 두 번 돌려도 결과가 같다(idempotent).

create or replace function public.expire_pending_bank_orders()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_id uuid;
  v_og public.order_groups;
  v_expired int := 0;
  v_released int := 0;
  v_skipped int := 0;
  v_cnt int;
begin
  if not public.booking_is_service_role() then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  for v_id in
    select id from public.order_groups
     where status = 'PENDING_PAYMENT'
       and method = 'BANK'
       and expires_at is not null
       and expires_at <= now()
     order by id
  loop
    -- 락 → 재확인. 그 사이 결제 확정이 이겼다면 건너뛴다.
    select * into v_og from public.order_groups where id = v_id for update;
    if not found or v_og.status <> 'PENDING_PAYMENT' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    update public.order_groups
       set status = 'EXPIRED', updated_at = now()
     where id = v_id and status = 'PENDING_PAYMENT';

    -- 좌석 반납: 상태 가드로 idempotent
    with c as (
      update public.bookings
         set status = 'CANCELLED', hold_expires_at = null
       where order_group_id = v_id and status = 'PENDING'
       returning id
    ) select count(*) into v_cnt from c;

    v_expired := v_expired + 1;
    v_released := v_released + v_cnt;
  end loop;

  return jsonb_build_object(
    'expired_orders', v_expired,
    'released_holds', v_released,
    'skipped', v_skipped,
    'swept_at', now()
  );
end $function$;

revoke all on function public.expire_pending_bank_orders() from public, anon, authenticated;
grant execute on function public.expire_pending_bank_orders() to service_role;;