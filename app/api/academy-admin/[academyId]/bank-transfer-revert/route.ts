/**
 * POST /api/academy-admin/[academyId]/bank-transfer-revert
 * Body: { orderId } — bank_transfer_orders.id
 * 확인완료된 계좌이체 주문을 입금대기 상태로 되돌립니다.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { logTicketEvent } from '@/lib/db/enrollment-activity-log';

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
      .select('id, status, user_id, user_ticket_id, revenue_transaction_id, schedule_id')
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
    let linkedBookingId: string | null = null;

    // 1) 이 주문에 연결된 예약이 있으면 PENDING으로 되돌리고, 스케줄 인원 수 정리
    if (scheduleId) {
      const { data: linkedBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('bank_transfer_order_id', orderId)
        .maybeSingle();

      if (linkedBooking) {
        linkedBookingId = linkedBooking.id;
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

    // 2) 동일 user_ticket 을 쓰는 나머지 예약(기간권 자동 예약 등)을 취소 처리 후 user_ticket 삭제
    //    - 삭제 전 스냅샷을 먼저 캡처해 활동 로그에 보존
    let userTicketSnapshot: Record<string, unknown> | null = null;
    let revenueSnapshot: Record<string, unknown> | null = null;
    let cancelledBookingIds: string[] = [];

    if (userTicketId) {
      // 2a) user_ticket 스냅샷 (삭제 후에는 조회 불가)
      const { data: utRow } = await supabase
        .from('user_tickets')
        .select('id, user_id, ticket_id, remaining_count, status, expiry_date, start_date, created_at')
        .eq('id', userTicketId)
        .maybeSingle();
      if (utRow) {
        userTicketSnapshot = {
          user_ticket_id: utRow.id,
          user_id: utRow.user_id,
          ticket_id: utRow.ticket_id,
          remaining_count: utRow.remaining_count,
          status: utRow.status,
          expiry_date: utRow.expiry_date,
          start_date: utRow.start_date,
          issued_at: utRow.created_at,
        };
      }

      // 2b) 영향 받는 예약 ID 목록 (link 된 것 + user_ticket 으로 묶인 것 모두)
      const { data: affectedBookings } = await supabase
        .from('bookings')
        .select('id, schedule_id, class_id, status')
        .eq('user_ticket_id', userTicketId);
      cancelledBookingIds = (affectedBookings || []).map((b: any) => b.id);

      // 2c) 예약별 CANCEL 로그 (취소 직전 상태 캡처)
      for (const b of (affectedBookings || []) as any[]) {
        await logTicketEvent({
          academy_id: academyId,
          user_id: order.user_id ?? null,
          user_ticket_id: userTicketId,
          booking_id: b.id,
          action: 'CANCEL',
          before: { status: b.status },
          after: { status: 'CANCELLED' },
          via: 'bank_transfer_revert',
          reason: 'admin_reverted_bank_transfer',
          context: {
            order_id: orderId,
            bank_transfer_order_id: orderId,
            schedule_id: b.schedule_id ?? null,
            class_id: b.class_id ?? null,
          },
          actor_user_id: user.id,
        }, supabase).catch(() => {});
      }

      await supabase
        .from('bookings')
        .update({ status: 'CANCELLED', user_ticket_id: null })
        .eq('user_ticket_id', userTicketId);
      await supabase.from('user_tickets').delete().eq('id', userTicketId);

      // 2d) user_ticket 삭제 로그 (삭제된 행을 payload 스냅샷으로 보존)
      if (userTicketSnapshot) {
        await logTicketEvent({
          academy_id: academyId,
          user_id: order.user_id ?? null,
          action: 'TICKET_DELETED',
          before: {
            remaining_count: userTicketSnapshot.remaining_count as number | null,
            status: userTicketSnapshot.status as string | null,
            expiry_date: userTicketSnapshot.expiry_date as string | null,
          },
          after: { remaining_count: null, status: null, expiry_date: null },
          via: 'bank_transfer_revert',
          reason: 'admin_reverted_bank_transfer',
          context: {
            deleted_user_ticket_id: userTicketId,
            order_id: orderId,
            bank_transfer_order_id: orderId,
            snapshot: userTicketSnapshot,
            cancelled_booking_ids: cancelledBookingIds,
          },
          actor_user_id: user.id,
        }, supabase).catch(() => {});
      }
    }

    // 3) 매출 기록 스냅샷 후 삭제
    if (revId) {
      const { data: revRow } = await supabase
        .from('revenue_transactions')
        .select('id, final_price, payment_method, ticket_name, transaction_date')
        .eq('id', revId)
        .maybeSingle();
      if (revRow) {
        revenueSnapshot = {
          revenue_transaction_id: revRow.id,
          final_price: revRow.final_price,
          payment_method: revRow.payment_method,
          ticket_name: revRow.ticket_name,
          transaction_date: revRow.transaction_date,
        };
      }
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

    // 활동 로그: 환불(입금 확인 되돌리기) — 매출/티켓 스냅샷, 취소된 예약 수, 결제 정보 포함
    logTicketEvent({
      academy_id: academyId,
      user_id: order.user_id ?? null,
      booking_id: linkedBookingId,
      action: 'REFUND',
      via: 'bank_transfer_revert',
      reason: 'admin_reverted_bank_transfer',
      context: {
        order_id: orderId,
        bank_transfer_order_id: orderId,
        reverted: true,
        deleted_user_ticket_id: userTicketId ?? null,
        cancelled_booking_count: cancelledBookingIds.length,
        cancelled_booking_ids: cancelledBookingIds,
        revenue_amount: (revenueSnapshot as any)?.final_price ?? null,
        payment_method: (revenueSnapshot as any)?.payment_method ?? 'BANK_TRANSFER',
        revenue_snapshot: revenueSnapshot,
      },
      actor_user_id: user.id,
    }, supabase).catch(() => {});

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
