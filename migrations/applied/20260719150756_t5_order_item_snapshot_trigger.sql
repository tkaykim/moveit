-- T5: order_items 의 추가 스냅샷(valid_months / is_coupon)을 삽입 시점에 얼린다.
--
-- 왜 트리거인가: T4 의 order_preflight / create_order_group 을 다시 쓰지 않고도
-- 같은 트랜잭션·같은 시점의 상품 값을 스냅샷할 수 있다. (T4 회귀 위험 0)
create or replace function public.trg_order_item_freeze_snapshots()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_t public.tickets;
begin
  if new.item_type <> 'TICKET_PURCHASE' or new.ticket_id is null then
    return new;
  end if;

  select * into v_t from public.tickets where id = new.ticket_id;
  if not found then
    return new;
  end if;

  -- count_options 로 valid_days 를 고른 경우에도 valid_months 는 상품 공통값이다.
  if new.valid_months_snapshot is null then
    new.valid_months_snapshot := v_t.valid_months;
  end if;
  if new.is_coupon_snapshot is null then
    new.is_coupon_snapshot := coalesce(v_t.is_coupon, false);
  end if;

  return new;
end $$;

revoke all on function public.trg_order_item_freeze_snapshots() from public, anon, authenticated;

drop trigger if exists order_items_freeze_snapshots on public.order_items;
create trigger order_items_freeze_snapshots
  before insert on public.order_items
  for each row execute function public.trg_order_item_freeze_snapshots();;