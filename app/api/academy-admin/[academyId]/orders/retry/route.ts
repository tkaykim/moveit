/**
 * POST /api/academy-admin/[academyId]/orders/retry  (T5)
 *
 * 막힌 주문(PAYMENT_APPROVED / FULFILLMENT_FAILED)의 안전한 재시도.
 * finalize_order_group 을 그대로 다시 돌린다 — 이미 발급된 수강권·예약·매출은
 * 다시 만들어지지 않는다(멱등). 결제 승인은 이미 커밋되어 있으므로 잃지 않는다.
 *
 * body: { orderGroupId }
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { finalizeOrder, parseFulfilmentError } from '@/lib/payments/fulfilment';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  try {
    await assertAcademyAdmin(academyId, user.id);
  } catch {
    return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const orderGroupId = body?.orderGroupId ?? body?.order_group_id;
    if (!orderGroupId) {
      return NextResponse.json({ error: 'orderGroupId가 필요합니다.' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;

    const { data: order } = await supabase
      .from('order_groups')
      .select('id, status, retry_count')
      .eq('id', orderGroupId)
      .eq('academy_id', academyId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    const result = await finalizeOrder(supabase, order.id, user.id);
    return NextResponse.json({ ...result, retry_count: order.retry_count });
  } catch (e: unknown) {
    const mapped = parseFulfilmentError(e);
    console.error('[academy-admin/orders/retry]', mapped.code, (e as Error)?.message);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code, detail: mapped.detail },
      { status: mapped.status }
    );
  }
}
