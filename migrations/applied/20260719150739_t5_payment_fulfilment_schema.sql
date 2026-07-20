-- T5: 결제 확정/이행 분리를 위한 추가 컬럼 (additive only)

-- 1) 스냅샷 보강: valid_months / is_coupon 도 주문 시점에 얼려야
--    "확정 시점에 상품이 바뀌어도 발급 내용은 안 바뀐다"가 성립한다.
alter table public.order_items
  add column if not exists valid_months_snapshot integer,
  add column if not exists is_coupon_snapshot boolean;

-- 2) 매출은 주문 항목당 정확히 한 줄. 유니크 인덱스가 "두 번 쓰기"를 물리적으로 막는다.
alter table public.revenue_transactions
  add column if not exists order_group_id uuid references public.order_groups(id),
  add column if not exists order_item_id uuid references public.order_items(id);

create unique index if not exists revenue_transactions_order_item_uniq
  on public.revenue_transactions (order_item_id)
  where order_item_id is not null;

create index if not exists revenue_transactions_order_group_idx
  on public.revenue_transactions (order_group_id)
  where order_group_id is not null;

-- 3) 이행 실패/승인대기 주문을 운영자가 조회할 수 있어야 한다 (막힌 주문 목록).
create index if not exists order_groups_stuck_idx
  on public.order_groups (academy_id, status, payment_approved_at)
  where status in ('PAYMENT_APPROVED', 'FULFILLMENT_FAILED');

-- 4) 결제 확정 이력 추적: 항목 하나가 어떤 수강권/예약을 만들었는지 이미
--    result_user_ticket_id / result_booking_id 로 기록된다. 같은 수강권이
--    두 항목에서 나오는 일이 없도록 유니크를 건다(이중 발급 물리 차단).
create unique index if not exists order_items_result_user_ticket_uniq
  on public.order_items (result_user_ticket_id)
  where result_user_ticket_id is not null;;