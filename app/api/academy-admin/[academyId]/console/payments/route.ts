/**
 * GET /api/academy-admin/[academyId]/console/payments   (T9)
 *
 * 결제 처리 화면의 조회 묶음.
 *   - pendingOrders : 확정 대기 주문 그룹 (계좌이체 입금확인 / 현장결제 기록 대상).
 *                     확정은 **주문 그룹 단위** — 한 번의 확인이 그룹 전체를 끝낸다.
 *                     그래서 항목(order_items)을 그룹에 미리 붙여서 내려준다.
 *   - refundable    : 환불 제안을 만들 수 있는 최근 결제 내역
 *   - proposals     : 이미 만들어진 환불 제안 (감사 기록 포함)
 *
 * 쿼리 수 고정 — 주문 1건당 항목 조회를 도는 N+1 을 만들지 않는다.
 */
import { NextRequest } from 'next/server';
import { withConsoleStaff } from '../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** 아직 확정되지 않은 = 스태프가 손 대야 하는 상태 */
const PENDING_STATUSES = ['DRAFT', 'PENDING_PAYMENT', 'PAYMENT_APPROVED', 'FULFILLMENT_FAILED'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;

  return withConsoleStaff(request, academyId, async ({ supabase }) => {
    const [ordersRes, revenueRes, proposalsRes] = await Promise.all([
      supabase
        .from('order_groups')
        .select(
          'id, user_id, method, status, total_amount, original_amount, discount_amount, orderer_name, orderer_phone, provider_order_id, expires_at, confirmed_at, fulfillment_error_code, fulfillment_error_message, retry_count, created_at'
        )
        .eq('academy_id', academyId)
        .in('status', PENDING_STATUSES)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('revenue_transactions')
        .select(
          'id, user_id, ticket_id, user_ticket_id, ticket_name, final_price, original_price, refunded_amount, payment_method, payment_status, transaction_date'
        )
        .eq('academy_id', academyId)
        .order('transaction_date', { ascending: false })
        .limit(50),
      supabase
        .from('refund_proposals')
        .select('*')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const orders = ordersRes.data ?? [];
    const orderIds = orders.map((o: any) => o.id);

    // 항목은 한 번에 (주문마다 도는 순간 N+1)
    const { data: items } = orderIds.length
      ? await supabase
          .from('order_items')
          .select(
            'id, order_group_id, item_type, ticket_name_snapshot, ticket_type_snapshot, grant_count_snapshot, final_amount, schedule_id, class_id'
          )
          .in('order_group_id', orderIds)
      : { data: [] as any[] };

    const itemsByOrder = new Map<string, any[]>();
    for (const it of items ?? []) {
      const list = itemsByOrder.get(it.order_group_id) ?? [];
      list.push(it);
      itemsByOrder.set(it.order_group_id, list);
    }

    // 주문자/학생 이름 (한 번에)
    const userIds = Array.from(
      new Set(
        [...orders.map((o: any) => o.user_id), ...(revenueRes.data ?? []).map((r: any) => r.user_id)].filter(
          Boolean
        )
      )
    );
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, name, nickname, phone').in('id', userIds)
      : { data: [] as any[] };
    const userMap = new Map<string, any>((users ?? []).map((u: any) => [u.id, u]));

    return {
      pendingOrders: orders.map((o: any) => ({
        ...o,
        student_name:
          userMap.get(o.user_id)?.name || userMap.get(o.user_id)?.nickname || o.orderer_name || '이름 없음',
        items: itemsByOrder.get(o.id) ?? [],
        item_count: (itemsByOrder.get(o.id) ?? []).length,
      })),
      refundable: (revenueRes.data ?? []).map((r: any) => ({
        ...r,
        student_name: userMap.get(r.user_id)?.name || userMap.get(r.user_id)?.nickname || '이름 없음',
      })),
      proposals: proposalsRes.data ?? [],
    };
  });
}
