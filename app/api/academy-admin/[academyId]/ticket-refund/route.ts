/**
 * POST /api/academy-admin/[academyId]/ticket-refund
 * Body: { revenueTransactionId, cancelReason?, cancelAmount? }
 *
 * 수강권 결제 환불 (토스 카드결제 + 계좌이체 + 관리자 수기 등 모든 결제수단 지원)
 * - 토스 결제: toss_payment_key 로 Toss cancel API 호출
 * - 계좌이체/현금/수기: 매출·수강권만 롤백 (PG 환불 없음)
 *
 * 롤백 순서:
 * 1. user_ticket 에 연결된 예약 전부 CANCELLED
 * 2. user_ticket 상태 REFUNDED
 * 3. revenue_transactions 상태 REFUNDED
 * 4. enrollment_activity_log 기록
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
    const { revenueTransactionId, userTicketId: inputUserTicketId, bookingId, cancelReason, cancelAmount } = body as {
      revenueTransactionId?: string;
      userTicketId?: string;
      bookingId?: string;
      cancelReason?: string;
      cancelAmount?: number;
    };

    if (!revenueTransactionId && !inputUserTicketId && !bookingId) {
      return NextResponse.json({ error: 'revenueTransactionId, userTicketId, bookingId 중 하나가 필요합니다.' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;

    // ── 0. 결제건 식별: revenueTransactionId 우선, 없으면 bookingId→user_ticket→revenue 역추적 ──
    let resolvedRevId: string | null = revenueTransactionId ?? null;
    let resolvedUserTicketId: string | null = inputUserTicketId ?? null;

    if (!resolvedRevId && bookingId) {
      const { data: bk } = await supabase
        .from('bookings')
        .select('user_ticket_id')
        .eq('id', bookingId)
        .maybeSingle();
      if (bk?.user_ticket_id) resolvedUserTicketId = bk.user_ticket_id;
    }

    if (!resolvedRevId && resolvedUserTicketId) {
      const { data: revByTicket } = await supabase
        .from('revenue_transactions')
        .select('id')
        .eq('user_ticket_id', resolvedUserTicketId)
        .eq('academy_id', academyId)
        .in('payment_status', ['COMPLETED', 'PARTIALLY_REFUNDED'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (revByTicket?.id) resolvedRevId = revByTicket.id;
    }

    if (!resolvedRevId) {
      return NextResponse.json({ error: '환불할 결제 내역을 찾을 수 없습니다. (수기 발급 등 결제 기록이 없는 건일 수 있습니다)' }, { status: 404 });
    }

    // ── 1. revenue_transaction 조회 ──
    const { data: rev, error: revErr } = await supabase
      .from('revenue_transactions')
      .select('id, academy_id, user_id, user_ticket_id, ticket_id, final_price, payment_method, payment_status, toss_payment_key, toss_order_id, ticket_name, quantity, valid_days, notes')
      .eq('id', resolvedRevId)
      .eq('academy_id', academyId)
      .single();

    if (revErr || !rev) {
      return NextResponse.json({ error: '해당 결제 내역을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (rev.payment_status === 'REFUNDED') {
      return NextResponse.json({ error: '이미 환불된 결제입니다.' }, { status: 400 });
    }
    if (rev.payment_status !== 'COMPLETED') {
      return NextResponse.json({ error: '완료된 결제만 환불할 수 있습니다.' }, { status: 400 });
    }

    // ── 2. 토스 결제인 경우 PG 환불 호출 ──
    let tossRefundResult: any = null;
    if (rev.toss_payment_key) {
      const secretKey = process.env.TOSS_SECRET_KEY;
      if (!secretKey) {
        return NextResponse.json({ error: '결제 설정(TOSS_SECRET_KEY)이 없습니다.' }, { status: 500 });
      }

      const cancelBody: { cancelReason: string; cancelAmount?: number } = {
        cancelReason: cancelReason ?? '학원 관리자 환불',
      };
      if (cancelAmount != null && cancelAmount > 0) {
        cancelBody.cancelAmount = cancelAmount;
      }

      const tossRes = await fetch(
        `https://api.tosspayments.com/v1/payments/${rev.toss_payment_key}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cancelBody),
        }
      );

      if (!tossRes.ok) {
        const errData = await tossRes.json().catch(() => ({}));
        console.error('[ticket-refund] Toss cancel failed:', errData);
        return NextResponse.json(
          { error: errData.message ?? '토스 결제 취소에 실패했습니다.' },
          { status: 400 }
        );
      }
      tossRefundResult = await tossRes.json().catch(() => null);
    }

    // ── 3. user_ticket 에 연결된 예약 취소 ──
    const userTicketId = rev.user_ticket_id;
    let userTicketSnapshot: Record<string, unknown> | null = null;
    let cancelledBookingIds: string[] = [];

    if (userTicketId) {
      const { data: utRow } = await supabase
        .from('user_tickets')
        .select('id, user_id, ticket_id, remaining_count, status, expiry_date, start_date, created_at')
        .eq('id', userTicketId)
        .maybeSingle();

      if (utRow) {
        userTicketSnapshot = {
          user_ticket_id: utRow.id,
          remaining_count: utRow.remaining_count,
          status: utRow.status,
          expiry_date: utRow.expiry_date,
          start_date: utRow.start_date,
        };
      }

      // 연결된 예약 조회 + 취소
      const { data: affectedBookings } = await supabase
        .from('bookings')
        .select('id, schedule_id, class_id, status')
        .eq('user_ticket_id', userTicketId);

      cancelledBookingIds = (affectedBookings || []).map((b: any) => b.id);

      if (cancelledBookingIds.length > 0) {
        // 예약별 CANCEL 로그
        for (const b of (affectedBookings || []) as any[]) {
          await logTicketEvent({
            academy_id: academyId,
            user_id: rev.user_id ?? null,
            user_ticket_id: userTicketId,
            booking_id: b.id,
            action: 'CANCEL',
            before: { status: b.status },
            after: { status: 'CANCELLED' },
            via: 'toss_payment',
            reason: 'refund',
            context: { revenue_transaction_id: rev.id },
            actor_user_id: user.id,
          }, supabase).catch(() => {});
        }

        await supabase
          .from('bookings')
          .update({ status: 'CANCELLED', user_ticket_id: null })
          .eq('user_ticket_id', userTicketId);

        // 스케줄 인원수 갱신
        const scheduleIds = [...new Set((affectedBookings || []).map((b: any) => b.schedule_id).filter(Boolean))];
        for (const sid of scheduleIds) {
          const { data: confirmed } = await supabase
            .from('bookings')
            .select('id')
            .eq('schedule_id', sid)
            .in('status', ['CONFIRMED', 'COMPLETED']);
          await supabase
            .from('schedules')
            .update({ current_students: confirmed?.length || 0 })
            .eq('id', sid);
        }
      }

      // user_ticket 상태 → REFUNDED
      await supabase
        .from('user_tickets')
        .update({ status: 'REFUNDED', remaining_count: 0 })
        .eq('id', userTicketId);

      // user_ticket 환불 로그
      await logTicketEvent({
        academy_id: academyId,
        user_id: rev.user_id ?? null,
        user_ticket_id: userTicketId,
        action: 'REFUND',
        before: {
          remaining_count: (userTicketSnapshot as any)?.remaining_count ?? null,
          status: (userTicketSnapshot as any)?.status ?? null,
          expiry_date: (userTicketSnapshot as any)?.expiry_date ?? null,
        },
        after: { remaining_count: 0, status: 'REFUNDED' },
        via: rev.toss_payment_key ? 'toss_payment' : 'bank_transfer',
        reason: cancelReason ?? 'admin_refund',
        context: {
          revenue_transaction_id: rev.id,
          toss_payment_key: rev.toss_payment_key ?? null,
          toss_order_id: rev.toss_order_id ?? null,
          refund_amount: cancelAmount ?? rev.final_price,
          payment_method: rev.payment_method,
          ticket_name: rev.ticket_name,
          cancelled_booking_count: cancelledBookingIds.length,
          cancelled_booking_ids: cancelledBookingIds,
          user_ticket_snapshot: userTicketSnapshot,
        },
        actor_user_id: user.id,
      }, supabase).catch(() => {});
    }

    // ── 4. revenue_transactions 상태 REFUNDED ──
    const refundedAmount = cancelAmount ?? rev.final_price;
    const isPartialRefund = cancelAmount != null && cancelAmount < rev.final_price;

    await supabase
      .from('revenue_transactions')
      .update({
        payment_status: isPartialRefund ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
        notes: [
          rev.notes,
          `[환불] ${new Date().toISOString()} by ${user.id}`,
          cancelReason ? `사유: ${cancelReason}` : null,
          isPartialRefund ? `부분환불: ${refundedAmount.toLocaleString()}원 / 원래 ${rev.final_price.toLocaleString()}원` : null,
        ].filter(Boolean).join(' | '),
      })
      .eq('id', rev.id);

    return NextResponse.json({
      success: true,
      message: rev.toss_payment_key
        ? '토스 결제 취소 및 환불 처리가 완료되었습니다.'
        : '환불 처리가 완료되었습니다. (PG 환불 없음 — 계좌이체/현금 건)',
      refundedAmount,
      isPartialRefund,
      cancelledBookings: cancelledBookingIds.length,
      tossRefund: tossRefundResult ? true : false,
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('[ticket-refund] error:', e);
    return NextResponse.json({ error: '환불 처리에 실패했습니다.' }, { status: 500 });
  }
}
