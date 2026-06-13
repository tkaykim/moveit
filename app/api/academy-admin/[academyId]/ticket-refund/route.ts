/**
 * POST /api/academy-admin/[academyId]/ticket-refund
 * Body: { revenueTransactionId | userTicketId | bookingId, dryRun?, refundAmount?, cancelReason? }
 *
 * 수강권 결제 환불 (토스 카드/간편결제 + 계좌이체 + 현금/수기 등 모든 결제수단).
 * - dryRun:true  → 권장 환불액·산정근거만 반환(부수효과 없음). 모달 프리뷰용.
 * - 실행          → refundAmount(관리자 최종값, 없으면 권장값)으로 환불.
 *
 * 정책: 학원법 시행령 반환기준 + 정가 차감(권장값) → 관리자 조정 가능(lib/refund/calc.ts).
 * 처리:
 * 1. 토스건 → Toss cancel (전액=전체취소 / 부분=cancelAmount / 0=호출 생략)
 * 2. 미래 예약(PENDING/CONFIRMED)만 CANCELLED — 출석완료(COMPLETED)·결석(ABSENT)은 보존
 * 3. user_ticket → REFUNDED, remaining_count 0
 * 4. revenue_transactions → REFUNDED(전액) | PARTIALLY_REFUNDED(부분), 금액·근거 기록
 * 5. enrollment_activity_log 기록
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { logTicketEvent } from '@/lib/db/enrollment-activity-log';
import { computeRefund } from '@/lib/refund/calc';

export const dynamic = 'force-dynamic';

/** 환불 시 취소 대상 예약 상태 — 미래/대기 예약만. 출석완료·결석·이미취소는 보존. */
const CANCELLABLE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED'] as const;

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
    const {
      revenueTransactionId,
      userTicketId: inputUserTicketId,
      bookingId,
      dryRun,
      refundAmount,
      cancelReason,
    } = body as {
      revenueTransactionId?: string;
      userTicketId?: string;
      bookingId?: string;
      dryRun?: boolean;
      refundAmount?: number;
      cancelReason?: string;
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

    // ── 1. revenue_transaction + 티켓 카테고리 조회 ──
    const { data: rev, error: revErr } = await supabase
      .from('revenue_transactions')
      .select('id, academy_id, user_id, user_ticket_id, ticket_id, original_price, final_price, refunded_amount, payment_method, payment_status, toss_payment_key, toss_order_id, ticket_name, ticket_type_snapshot, quantity, valid_days, notes')
      .eq('id', resolvedRevId)
      .eq('academy_id', academyId)
      .single();

    if (revErr || !rev) {
      return NextResponse.json({ error: '해당 결제 내역을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (rev.payment_status === 'REFUNDED') {
      return NextResponse.json({ error: '이미 환불된 결제입니다.' }, { status: 400 });
    }
    if (rev.payment_status !== 'COMPLETED' && rev.payment_status !== 'PARTIALLY_REFUNDED') {
      return NextResponse.json({ error: '완료된 결제만 환불할 수 있습니다.' }, { status: 400 });
    }

    // 티켓 카테고리(워크샵/팝업 판별) + user_ticket 사용 현황
    let ticketCategory: string | null = null;
    if (rev.ticket_id) {
      const { data: tk } = await supabase.from('tickets').select('ticket_category').eq('id', rev.ticket_id).maybeSingle();
      ticketCategory = tk?.ticket_category ?? null;
    }

    const userTicketId = rev.user_ticket_id;
    let utRow: any = null;
    let attendedCount: number | null = null;
    if (userTicketId) {
      const { data } = await supabase
        .from('user_tickets')
        .select('id, user_id, ticket_id, remaining_count, status, expiry_date, start_date, created_at')
        .eq('id', userTicketId)
        .maybeSingle();
      utRow = data;

      // 실제 출석(COMPLETED) 회차 — 횟수제 부과 기준
      const { count: attended } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('user_ticket_id', userTicketId)
        .eq('status', 'COMPLETED');
      attendedCount = attended ?? 0;
    }

    // ── 2. 권장 환불액 산정 (서버 단일 소스) ──
    const calc = computeRefund({
      ticketTypeSnapshot: rev.ticket_type_snapshot,
      ticketCategory,
      quantity: rev.quantity,
      remainingCount: utRow?.remaining_count ?? null,
      attendedCount,
      startDate: utRow?.start_date ?? null,
      expiryDate: utRow?.expiry_date ?? null,
      validDays: rev.valid_days,
      ticketStatus: utRow?.status ?? null,
      originalPrice: rev.original_price,
      finalPrice: rev.final_price,
      nowISO: new Date().toISOString(),
    });

    // ── dryRun: 산정 결과만 반환 ──
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        paidAmount: calc.paidAmount,
        suggestedRefund: calc.suggestedRefund,
        basis: calc.basis,
        breakdown: calc.breakdown,
        kind: calc.kind,
        expired: calc.expired,
        isToss: !!rev.toss_payment_key,
        paymentMethod: rev.payment_method,
        ticketName: rev.ticket_name,
      });
    }

    // ── 실행: 최종 환불액 결정 (관리자 입력 > 권장값) ──
    // 이미 일부 환불된 건의 재환불도 안전하도록 누적 기준으로 계산.
    const paid = calc.paidAmount;
    const prevRefunded = Math.max(0, Math.min(rev.refunded_amount ?? 0, paid));
    const remainingRefundable = Math.max(0, paid - prevRefunded);
    let thisRefund = refundAmount != null ? Math.round(refundAmount) : calc.suggestedRefund;
    thisRefund = Math.max(0, Math.min(thisRefund, remainingRefundable));
    const totalRefunded = prevRefunded + thisRefund;
    const isPartial = totalRefunded < paid;
    const newStatus = isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
    const reason = (cancelReason ?? '').toString().trim().slice(0, 190);
    const refundNote = [
      rev.notes,
      `[환불 ${thisRefund.toLocaleString()}원 / 누적 ${totalRefunded.toLocaleString()}원 / 결제 ${paid.toLocaleString()}원] ${new Date().toISOString()} by ${user.id}`,
      reason ? `사유: ${reason}` : null,
      `산정: ${calc.basis}`,
    ].filter(Boolean).join(' | ');

    // ── 3. 멱등 claim: COMPLETED/PARTIALLY_REFUNDED 상태일 때만 단 한 요청이 차지(동시 더블클릭 차단). ──
    //     revenue 상태를 먼저 갱신해 락 역할을 시킨 뒤 토스를 호출하고, 토스 실패 시 원복한다.
    const { data: claimed, error: claimErr } = await supabase
      .from('revenue_transactions')
      .update({ payment_status: newStatus, refunded_amount: totalRefunded, notes: refundNote })
      .eq('id', rev.id)
      .in('payment_status', ['COMPLETED', 'PARTIALLY_REFUNDED'])
      .select('id');
    if (claimErr) {
      console.error('[ticket-refund] claim update failed:', claimErr);
      return NextResponse.json({ error: '환불 기록 갱신에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ error: '이미 환불 처리 중이거나 완료된 결제입니다.' }, { status: 409 });
    }

    // ── 4. 토스 PG 취소 (금액 > 0 인 경우만). 실패 시 revenue 상태 원복. ──
    let tossRefundResult: any = null;
    if (rev.toss_payment_key && thisRefund > 0) {
      const secretKey = process.env.TOSS_SECRET_KEY;
      const rollback = async () => {
        await supabase
          .from('revenue_transactions')
          .update({ payment_status: rev.payment_status, refunded_amount: prevRefunded, notes: rev.notes })
          .eq('id', rev.id);
      };
      if (!secretKey) {
        await rollback();
        return NextResponse.json({ error: '결제 설정(TOSS_SECRET_KEY)이 없습니다.' }, { status: 500 });
      }
      // 전액 단건 취소면 cancelAmount 생략, 그 외(부분/재환불)는 이번 회차 금액 지정
      const fullSingleCancel = prevRefunded === 0 && thisRefund === paid;
      const cancelBody: { cancelReason: string; cancelAmount?: number } = {
        cancelReason: reason || '학원 관리자 환불',
      };
      if (!fullSingleCancel) cancelBody.cancelAmount = thisRefund;

      let tossRes: Response;
      try {
        tossRes = await fetch(
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
      } catch (netErr) {
        console.error('[ticket-refund] Toss network error:', netErr);
        await rollback();
        return NextResponse.json({ error: '토스 결제 취소 요청 중 네트워크 오류가 발생했습니다. 다시 시도해 주세요.' }, { status: 502 });
      }
      if (!tossRes.ok) {
        const errData = await tossRes.json().catch(() => ({}));
        console.error('[ticket-refund] Toss cancel failed:', errData);
        await rollback();
        return NextResponse.json({ error: (errData as any).message ?? '토스 결제 취소에 실패했습니다.' }, { status: 400 });
      }
      tossRefundResult = await tossRes.json().catch(() => null);
    }

    // 토스 취소까지 성공(또는 PG 미연동/0원) → 이제 수강권·예약 정리.
    // 여기서부터 실패하면 "토스는 환불됐는데 시스템 미반영" 상태이므로 에러를 surface 한다.
    const postWarnings: string[] = [];

    // ── 5. 미래 예약(PENDING/CONFIRMED)만 취소 — 출석완료·결석은 보존 ──
    //     스케줄 current_students 는 bookings 트리거(sync_schedule_student_count)가 자동 갱신하므로 수동 재계산 안 함.
    let cancelledBookingIds: string[] = [];
    if (userTicketId) {
      const { data: cancellable } = await supabase
        .from('bookings')
        .select('id, schedule_id, status')
        .eq('user_ticket_id', userTicketId)
        .in('status', CANCELLABLE_BOOKING_STATUSES as unknown as string[]);

      cancelledBookingIds = (cancellable || []).map((b: any) => b.id);

      for (const b of (cancellable || []) as any[]) {
        await logTicketEvent({
          academy_id: academyId,
          user_id: rev.user_id ?? null,
          user_ticket_id: userTicketId,
          booking_id: b.id,
          action: 'CANCEL',
          before: { status: b.status },
          after: { status: 'CANCELLED' },
          via: rev.toss_payment_key ? 'toss_payment' : 'bank_transfer',
          reason: 'refund',
          context: { revenue_transaction_id: rev.id },
          actor_user_id: user.id,
        }, supabase).catch(() => {});
      }

      if (cancelledBookingIds.length > 0) {
        const { error: bkErr } = await supabase
          .from('bookings')
          .update({ status: 'CANCELLED', user_ticket_id: null })
          .in('id', cancelledBookingIds);
        if (bkErr) {
          console.error('[ticket-refund] booking cancel failed:', bkErr);
          postWarnings.push('일부 예약 취소에 실패했습니다. 예약 상태를 확인해 주세요.');
        }
      }

      // user_ticket → REFUNDED (해지). 전액 환불이 아닌 경우에도 해지(부분환불=중도해지).
      const { error: utErr } = await supabase
        .from('user_tickets')
        .update({ status: 'REFUNDED', remaining_count: 0 })
        .eq('id', userTicketId);
      if (utErr) {
        console.error('[ticket-refund] user_ticket update failed:', utErr);
        postWarnings.push('수강권 상태 갱신에 실패했습니다. 수강권을 확인해 주세요.');
      }

      await logTicketEvent({
        academy_id: academyId,
        user_id: rev.user_id ?? null,
        user_ticket_id: userTicketId,
        action: 'REFUND',
        before: {
          remaining_count: utRow?.remaining_count ?? null,
          status: utRow?.status ?? null,
          expiry_date: utRow?.expiry_date ?? null,
        },
        after: { remaining_count: 0, status: 'REFUNDED' },
        via: rev.toss_payment_key ? 'toss_payment' : 'bank_transfer',
        reason: reason || 'admin_refund',
        context: {
          revenue_transaction_id: rev.id,
          toss_payment_key: rev.toss_payment_key ?? null,
          toss_order_id: rev.toss_order_id ?? null,
          paid_amount: paid,
          refund_amount: thisRefund,
          total_refunded: totalRefunded,
          is_partial: isPartial,
          suggested_refund: calc.suggestedRefund,
          calc_basis: calc.basis,
          payment_method: rev.payment_method,
          ticket_name: rev.ticket_name,
          ticket_kind: calc.kind,
          cancelled_booking_count: cancelledBookingIds.length,
          cancelled_booking_ids: cancelledBookingIds,
        },
        actor_user_id: user.id,
      }, supabase).catch(() => {});
    }

    const offlineNote = !rev.toss_payment_key
      ? ' (계좌이체/현금/수기 건 — 시스템 처리만 완료, 실제 금액은 현장에서 환불해 주세요)'
      : thisRefund === 0
        ? ' (환불액 0원 — PG 취소 없이 수강권만 해지)'
        : '';
    const warnNote = postWarnings.length ? ` ⚠️ ${postWarnings.join(' ')}` : '';

    return NextResponse.json({
      success: true,
      message: `환불 처리가 완료되었습니다.${offlineNote}${warnNote}`,
      paidAmount: paid,
      refundedAmount: thisRefund,
      totalRefunded,
      isPartialRefund: isPartial,
      cancelledBookings: cancelledBookingIds.length,
      tossRefund: !!tossRefundResult,
      warnings: postWarnings,
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('[ticket-refund] error:', e);
    return NextResponse.json({ error: '환불 처리에 실패했습니다.' }, { status: 500 });
  }
}
