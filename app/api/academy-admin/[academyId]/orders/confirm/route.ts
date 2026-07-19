/**
 * POST /api/academy-admin/[academyId]/orders/confirm  (T5)
 *
 * 학원 스태프의 주문 확정 — BANK(입금 확인) · ONSITE(현장 결제) 공통 입구.
 * 권한은 **서버에서** 확인한다 (assertAcademyAdmin). 클라이언트 플래그는 신뢰하지 않는다.
 *
 * BANK   : 입금 확인 → 그룹 전체를 한 번에 확정. 기존 PENDING 홀드가 CONFIRMED 로 승격된다.
 *          T4 만료 스윕과 같은 주문 행 락을 잡으므로 확정/만료 중 정확히 하나만 이긴다.
 * ONSITE : 현장 결제 기록 후 즉시 확정.
 *
 * body: { orderGroupId }  또는  { providerOrderId }
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { approveAndFinalize, parseFulfilmentError } from '@/lib/payments/fulfilment';

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
    const providerOrderId = body?.providerOrderId ?? body?.provider_order_id;

    if (!orderGroupId && !providerOrderId) {
      return NextResponse.json({ error: '주문 정보가 필요합니다.' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;

    let q = supabase
      .from('order_groups')
      .select('id, academy_id, method, status, total_amount')
      .eq('academy_id', academyId);
    q = orderGroupId ? q.eq('id', orderGroupId) : q.eq('provider_order_id', providerOrderId);

    const { data: order } = await q.maybeSingle();
    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (order.method === 'TOSS') {
      return NextResponse.json(
        { error: '카드 결제 주문은 결제 승인 경로로만 확정됩니다.', code: 'ORDER_METHOD_MISMATCH' },
        { status: 409 }
      );
    }

    const result = await approveAndFinalize(supabase, {
      orderGroupId: order.id,
      // 스태프 확정은 주문 총액을 그대로 수납한 것으로 본다.
      approvedAmount: order.total_amount,
      method: order.method as 'BANK' | 'ONSITE',
      paymentKey: null,
      confirmedBy: user.id,
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const mapped = parseFulfilmentError(e);
    console.error('[academy-admin/orders/confirm]', mapped.code, (e as Error)?.message);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code, detail: mapped.detail },
      { status: mapped.status }
    );
  }
}
