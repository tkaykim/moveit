/**
 * POST /api/orders/toss-confirm  (T5)
 *
 * Toss 승인 → 승인 기록(커밋) → 이행(finalize_order_group).
 *
 * 순서가 중요하다:
 *   ① Toss 승인 (외부, 멱등키 전송)
 *   ② 승인 금액 == 주문 총액 확인. 다르면 이행하지 않는다.
 *   ③ 승인 기록 커밋 → 이행. 이행이 실패해도 승인은 남아 재시도로 복구된다.
 *
 * body: { orderId (= provider_order_id), paymentKey, amount }
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { confirmTossPayment } from '@/lib/payments/toss';
import {
  approveAndFinalize,
  parseFulfilmentError,
  type FinalizeResult,
} from '@/lib/payments/fulfilment';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const providerOrderId = body?.orderId ?? body?.providerOrderId;
    const paymentKey = body?.paymentKey;
    const amount = Number(body?.amount);

    if (!providerOrderId || !paymentKey || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'orderId, paymentKey, amount가 필요합니다.' },
        { status: 400, headers: NO_CACHE }
      );
    }

    const supabase = createServiceClient() as any;

    const { data: order } = await supabase
      .from('order_groups')
      .select('id, user_id, academy_id, method, status, total_amount, provider_order_id')
      .eq('provider_order_id', providerOrderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404, headers: NO_CACHE });
    }
    if (order.method !== 'TOSS') {
      return NextResponse.json(
        { error: '카드 결제 주문이 아닙니다.', code: 'ORDER_METHOD_MISMATCH' },
        { status: 409, headers: NO_CACHE }
      );
    }

    // 신원은 서버 세션에서만. 회원 주문이면 본인만 확정할 수 있다.
    const user = await getAuthenticatedUser(request);
    if (order.user_id && user?.id !== order.user_id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403, headers: NO_CACHE });
    }

    // 이미 확정된 주문이면 결제사를 다시 부르지 않고 그대로 돌려준다 (중복 승인 방지).
    if (order.status === 'CONFIRMED') {
      return NextResponse.json(
        { ok: true, idempotent: true, order_group_id: order.id, status: 'CONFIRMED' },
        { headers: NO_CACHE }
      );
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: '결제 설정(TOSS_SECRET_KEY)이 없습니다.' },
        { status: 500, headers: NO_CACHE }
      );
    }

    // 멱등키 = provider_order_id. 주문당 유일하고 재시도해도 같은 값.
    const approval = await confirmTossPayment({
      paymentKey,
      orderId: order.provider_order_id,
      amount: order.total_amount,
      secretKey,
      idempotencyKey: order.provider_order_id,
    });

    if (!approval.ok) {
      return NextResponse.json(
        { error: approval.errorMessage, code: approval.errorCode },
        { status: 402, headers: NO_CACHE }
      );
    }

    // ⚠ 승인 금액 검증 — 주문 총액과 다르면 이행하지 않는다.
    const approvedAmount = approval.approvedAmount;
    if (approvedAmount == null || approvedAmount !== order.total_amount) {
      console.error(
        '[toss-confirm] AMOUNT_MISMATCH order=%s expected=%s approved=%s',
        order.id,
        order.total_amount,
        approval.approvedAmount
      );
      return NextResponse.json(
        {
          error: '결제 승인 금액이 주문 금액과 일치하지 않습니다.',
          code: 'ORDER_AMOUNT_MISMATCH',
          expected: order.total_amount,
          approved: approval.approvedAmount,
        },
        { status: 409, headers: NO_CACHE }
      );
    }

    const result: FinalizeResult = await approveAndFinalize(supabase, {
      orderGroupId: order.id,
      approvedAmount,
      method: 'TOSS',
      paymentKey: approval.paymentKey ?? paymentKey,
      confirmedBy: order.user_id ?? null,
    });

    return NextResponse.json(result, { headers: NO_CACHE });
  } catch (e: unknown) {
    const mapped = parseFulfilmentError(e);
    console.error('[orders/toss-confirm]', mapped.code, (e as Error)?.message);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code, detail: mapped.detail },
      { status: mapped.status, headers: NO_CACHE }
    );
  }
}
