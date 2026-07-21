/**
 * POST /api/a/[academyId]/onsite-order  — 라이트 어드민 "현장결제 / 수강권 수동 발급"
 *
 * 스태프가 **학생을 대신해** 현장결제 주문을 만들고 즉시 확정한다.
 * (학생 결제 라우트 /api/orders 는 세션 본인 명의로만 발급하므로, 대리 발급은 이 스태프 전용 입구가 필요하다.)
 *
 * 비즈니스 로직을 새로 만들지 않는다 — 기존 정본 함수를 그대로 엮는다:
 *   composeOrder(method:'ONSITE')  = create_order_group (가격·재검증·스냅샷은 서버가 권위)
 *   approveAndFinalize             = 입금/현장/카드 공통 이행 (멱등)
 * 결제수단 메모(현금/카드단말)는 표시용일 뿐 — 발급/매출 판정에는 쓰이지 않는다.
 *
 * body: {
 *   userId?: string|null,               // 회원 대상. 없으면 orderer 필수 (비회원)
 *   orderer?: { name, phone },          // 비회원 대상
 *   items: OrderItemInput[],            // TICKET_PURCHASE (+ 선택: SCHEDULE_BOOKING 오늘예약)
 *   providerOrderId?: string,           // 더블탭 방지 멱등키
 * }
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { composeOrder, newProviderOrderId, sanitizeItems } from '@/lib/orders/composer';
import { parseOrderError } from '@/lib/orders/types';
import { approveAndFinalize, parseFulfilmentError } from '@/lib/payments/fulfilment';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;

  const staff = await getAuthenticatedUser(request);
  if (!staff) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  try {
    await assertAcademyAdmin(academyId, staff.id);
  } catch {
    return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const targetUserId: string | null = body?.userId ? String(body.userId) : null;
  const orderer = body?.orderer && body.orderer.name ? body.orderer : null;
  const items = sanitizeItems(body?.items);

  if (items.length === 0) {
    return NextResponse.json({ error: '발급할 항목이 없습니다.' }, { status: 400 });
  }
  if (!targetUserId && !orderer?.name) {
    return NextResponse.json(
      { error: '학생을 선택하거나 비회원 이름·연락처를 입력해 주세요.', code: 'TARGET_REQUIRED' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient() as any;
  const providerOrderId = body?.providerOrderId || newProviderOrderId('MVO');

  // ① 주문 생성 (ONSITE). 서버가 가격·항목을 재검증한다.
  let created;
  try {
    created = await composeOrder(supabase, {
      academyId,
      method: 'ONSITE',
      items,
      userId: targetUserId,
      orderer,
      providerOrderId,
    });
  } catch (e: unknown) {
    const mapped = parseOrderError(e);
    console.error('[a/onsite-order:compose]', mapped.code, mapped.itemCode, (e as Error)?.message);
    // 검증된 주문 엔진 규칙: 수강권은 user_tickets.user_id 로만 발급된다 →
    // 비회원(orderer만) 대상 수강권 발급은 엔진이 SIGN_IN_REQUIRED 로 거절한다. 우회하지 않고 그대로 안내한다.
    const friendly =
      mapped.itemCode === 'SIGN_IN_REQUIRED'
        ? '비회원에게는 수강권을 발급할 수 없어요. 학생을 회원으로 먼저 등록한 뒤 발급해 주세요.'
        : mapped.message;
    return NextResponse.json(
      { error: friendly, code: mapped.code, itemIndex: mapped.itemIndex, itemCode: mapped.itemCode },
      { status: mapped.status }
    );
  }

  // ② 즉시 확정 (현장 수납). 이미 확정된 멱등 재요청도 안전하다.
  try {
    const result = await approveAndFinalize(supabase, {
      orderGroupId: created.order_group_id,
      approvedAmount: created.total_amount,
      method: 'ONSITE',
      paymentKey: null,
      confirmedBy: staff.id,
    });
    return NextResponse.json({
      success: true,
      order_group_id: created.order_group_id,
      total_amount: created.total_amount,
      idempotent: created.idempotent,
      issued_tickets: result.issued_tickets,
      created_bookings: result.created_bookings,
      user_ticket_ids: result.user_ticket_ids,
      status: result.status,
    });
  } catch (e: unknown) {
    const mapped = parseFulfilmentError(e);
    console.error('[a/onsite-order:finalize]', mapped.code, (e as Error)?.message);
    // 주문은 생성됐으나 이행이 막힌 경우 — 결제 탭 "처리 필요"에서 재시도 가능하다.
    return NextResponse.json(
      { error: mapped.message, code: mapped.code, detail: mapped.detail, order_group_id: created.order_group_id },
      { status: mapped.status }
    );
  }
}
