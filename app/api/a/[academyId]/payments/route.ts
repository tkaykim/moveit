/**
 * GET /api/a/[academyId]/payments  — 라이트 어드민 "입금·결제" 탭 조회 묶음
 *
 * 한 번의 요청으로 세 목록을 채운다 (인포데스크 폰 화면 = 한 번의 왕복):
 *   - bankPending : 입금 대기 (BANK · PENDING_PAYMENT). 항목·금액·만료를 붙여서 준다.
 *   - stuck       : 결제는 됐는데 이행이 막힌 주문 (list_stuck_orders 정본 RPC).
 *   - history     : 만료·취소된 주문 (읽기 전용 히스토리).
 *
 * 비즈니스 로직 없음 — 순수 조회만. 확정/재시도는 기존 검증된 라우트
 * (academy-admin/orders/confirm · orders/retry)를 그대로 쓴다.
 */
import { NextRequest } from 'next/server';
import { withStaff } from '../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const HISTORY_STATUSES = ['EXPIRED', 'CANCELED'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const [bankRes, stuckRes, historyRes] = await Promise.all([
      supabase
        .from('order_groups')
        .select(
          'id, user_id, method, status, total_amount, original_amount, discount_amount, orderer_name, orderer_phone, expires_at, created_at'
        )
        .eq('academy_id', academyId)
        .eq('method', 'BANK')
        .eq('status', 'PENDING_PAYMENT')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.rpc('list_stuck_orders', { p_academy_id: academyId, p_limit: 200 }),
      supabase
        .from('order_groups')
        .select('id, user_id, method, status, total_amount, orderer_name, created_at')
        .eq('academy_id', academyId)
        .in('status', HISTORY_STATUSES)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    const bank = bankRes.data ?? [];
    const bankIds = bank.map((o: any) => o.id);

    // 항목은 한 번에 (주문마다 도는 순간 N+1)
    const { data: items } = bankIds.length
      ? await supabase
          .from('order_items')
          .select('id, order_group_id, item_type, ticket_name_snapshot, grant_count_snapshot, schedule_id')
          .in('order_group_id', bankIds)
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
        [
          ...bank.map((o: any) => o.user_id),
          ...(historyRes.data ?? []).map((o: any) => o.user_id),
        ].filter(Boolean)
      )
    );
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, name, nickname').in('id', userIds)
      : { data: [] as any[] };
    const userMap = new Map<string, any>((users ?? []).map((u: any) => [u.id, u]));
    const nameOf = (o: any) =>
      userMap.get(o.user_id)?.name || userMap.get(o.user_id)?.nickname || o.orderer_name || '이름 없음';

    return {
      bankPending: bank.map((o: any) => ({
        ...o,
        student_name: nameOf(o),
        items: itemsByOrder.get(o.id) ?? [],
        item_count: (itemsByOrder.get(o.id) ?? []).length,
      })),
      stuck: stuckRes.data ?? [],
      history: (historyRes.data ?? []).map((o: any) => ({ ...o, student_name: nameOf(o) })),
    };
  });
}
