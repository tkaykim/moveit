/**
 * GET /api/orders/status?providerOrderId=...   (T10)
 *
 * 주문의 **진짜 상태**를 돌려준다. 결제 도중 새로고침하거나 앱이 죽어도
 * 학생이 다시 들어와 자기 주문이 어떻게 됐는지 확인할 수 있어야 한다.
 *
 * 정직하게 구분한다:
 *   CONFIRMED          → 완료
 *   PAYMENT_APPROVED   → **결제는 됐고 처리 중** (절대 실패라고 말하지 않는다)
 *   FULFILLMENT_FAILED → 결제됨 + 처리 실패 → 복구 안내
 *   PENDING_PAYMENT    → 입금/결제 대기
 *   EXPIRED / CANCELED → 종료
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';

// 서비스 클라이언트를 쓰므로 Next Data Cache 를 끈다 (재시작 후에도 남는 캐시가
// 이미 이 프로젝트에서 stale read 를 만든 적이 있다).
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const;

/** 상태 → 학생에게 보여줄 단계. 화면이 문구를 지어내지 않도록 서버가 정한다. */
export type OrderPhase = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'CLOSED';

const PHASE: Record<string, OrderPhase> = {
  DRAFT: 'PENDING',
  PENDING_PAYMENT: 'PENDING',
  PAYMENT_APPROVED: 'PROCESSING',
  CONFIRMED: 'DONE',
  FULFILLMENT_FAILED: 'FAILED',
  CANCELED: 'CLOSED',
  EXPIRED: 'CLOSED',
};

const PHASE_MESSAGE: Record<OrderPhase, string> = {
  PENDING: '결제를 기다리고 있습니다.',
  PROCESSING: '결제는 완료됐고 처리 중입니다. 잠시만 기다려 주세요.',
  DONE: '결제가 완료되었습니다.',
  FAILED: '결제는 완료됐지만 처리 중 문제가 생겼습니다. 학원에 문의해 주세요.',
  CLOSED: '종료된 주문입니다.',
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerOrderId = searchParams.get('providerOrderId');
    if (!providerOrderId) {
      return NextResponse.json(
        { error: '주문 번호가 필요합니다.' },
        { status: 400, headers: NO_CACHE }
      );
    }

    const supabase = createServiceClient() as any;

    const { data: order } = await supabase
      .from('order_groups')
      .select(
        'id, academy_id, user_id, method, status, total_amount, original_amount, discount_amount, ' +
          'provider_order_id, expires_at, payment_approved_at, confirmed_at, fulfillment_error_code'
      )
      .eq('provider_order_id', providerOrderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404, headers: NO_CACHE }
      );
    }

    // 회원 주문은 본인만 조회할 수 있다. (게스트 주문은 주문번호를 아는 사람만 볼 수 있다)
    const user = await getAuthenticatedUser(request);
    if (order.user_id && user?.id !== order.user_id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403, headers: NO_CACHE });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select(
        'id, item_type, ticket_name_snapshot, final_amount, schedule_id, ' +
          'result_user_ticket_id, result_booking_id'
      )
      .eq('order_group_id', order.id);

    const phase = PHASE[order.status] ?? 'PENDING';

    return NextResponse.json(
      {
        provider_order_id: order.provider_order_id,
        order_group_id: order.id,
        status: order.status,
        phase,
        message: PHASE_MESSAGE[phase],
        method: order.method,
        total_amount: order.total_amount,
        original_amount: order.original_amount,
        discount_amount: order.discount_amount,
        expires_at: order.expires_at,
        payment_approved_at: order.payment_approved_at,
        confirmed_at: order.confirmed_at,
        fulfillment_error_code: order.fulfillment_error_code,
        items: items ?? [],
      },
      { headers: NO_CACHE }
    );
  } catch (e: unknown) {
    console.error('[orders/status]', (e as Error)?.message);
    return NextResponse.json(
      { error: '주문 상태를 불러오지 못했습니다.' },
      { status: 500, headers: NO_CACHE }
    );
  }
}
