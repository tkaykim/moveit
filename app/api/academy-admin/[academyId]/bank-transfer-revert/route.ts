/**
 * POST /api/academy-admin/[academyId]/bank-transfer-revert
 * Body: { orderId } — bank_transfer_orders.id
 * 확인완료된 계좌이체 주문을 입금대기 상태로 되돌립니다.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    await assertAcademyAdmin(academyId, user.id);

    const body = await request.json();
    const orderId = body?.orderId;
    if (!orderId) {
      return NextResponse.json({ error: 'orderId가 필요합니다.' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;

    const { data: order, error: orderError } = await supabase
      .from('bank_transfer_orders')
      .select('id, status, user_ticket_id, revenue_transaction_id, schedule_id')
      .eq('id', orderId)
      .eq('academy_id', academyId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (order.status !== 'CONFIRMED') {
      return NextResponse.json({ error: '확인완료된 건만 입금대기로 되돌릴 수 있습니다.' }, { status: 400 });
    }

    const userTicketId = order.user_ticket_id;
    const revId = order.revenue_transaction_id;
    const scheduleId = order.schedule_id;

    // 1) 이 주문에 연결된 예약이 있으면 PENDING으로 되돌리고, 스케줄 인원 수 정리
    if (scheduleId) {
      const { data: linkedBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('bank_transfer_order_id', orderId)
        .maybeSingle();

      if (linkedBooking) {
        await supabase
          .from('bookings')
          .update({
            status: 'PENDING',
            payment_status: 'PENDING',
            user_ticket_id: null,
          })
          .eq('id', linkedBooking.id);

        const { data: confirmedBookings } = await supabase
          .from('bookings')
          .select('id')
          .eq('schedule_id', scheduleId)
          .in('status', ['CONFIRMED', 'COMPLETED']);
        const actualCount = confirmedBookings?.length || 0;
        await supabase
          .from('schedules')
          .update({ current_students: actualCount })
          .eq('id', scheduleId);
      }
    }

    // 2) 동일 user_ticket을 쓰는 나머지 예약(기간권 자동 예약 등)은 취소 처리 후 user_ticket 삭제
    if (userTicketId) {
      await supabase
        .from('bookings')
        .update({ status: 'CANCELLED', user_ticket_id: null })
        .eq('user_ticket_id', userTicketId);
      await supabase.from('user_tickets').delete().eq('id', userTicketId);
    }

    // 3) 매출 기록 삭제
    if (revId) {
      await supabase.from('revenue_transactions').delete().eq('id', revId);
    }

    // 4) 주문 상태만 입금대기로 되돌리기
    await supabase
      .from('bank_transfer_orders')
      .update({
        status: 'PENDING',
        confirmed_at: null,
        confirmed_by: null,
        user_ticket_id: null,
        revenue_transaction_id: null,
      })
      .eq('id', orderId);

    return NextResponse.json({
      success: true,
      message: '입금대기 상태로 되돌렸습니다.',
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('bank-transfer-revert error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
