import { NextResponse } from 'next/server';
import { getTicketById } from '@/lib/db/tickets';
import { createBookingsForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { insertEnrollmentActivityLog, logTicketEvent } from '@/lib/db/enrollment-activity-log';
import { isPeriodTicket as checkIsPeriodTicket } from '@/lib/utils/ticket-type';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';
import { sendNotification } from '@/lib/notifications';
import { getTossPaymentMethodCode } from '@/lib/toss/payment-method';

const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

/** 결제 확인 응답이 캐시되면 이전 주문 결과가 반환될 수 있으므로 항상 동적 처리·캐시 무효 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const;

/**
 * Toss 결제 승인 후 수강권 발급 및 예약
 * Body: { paymentKey, orderId, amount } (successUrl 쿼리에서 전달)
 */
export async function POST(request: Request) {
  try {
    const authUser = await getAuthenticatedUser(request);

    const body = await request.json();
    const { paymentKey, orderId, amount: requestAmount } = body;
    if (!paymentKey || !orderId || requestAmount == null) {
      return NextResponse.json({ error: 'paymentKey, orderId, amount가 필요합니다.' }, { status: 400 });
    }

    const amount = Number(requestAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: '유효하지 않은 결제 금액입니다.' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;

    // 로그인 사용자: user_id 매칭, 비회원: orderId만으로 조회
    let orderQuery = supabase
      .from('user_ticket_payment_orders')
      .select('*')
      .eq('order_id', orderId);
    if (authUser) {
      orderQuery = orderQuery.eq('user_id', authUser.id);
    }
    const { data: order, error: orderError } = await orderQuery.single();

    if (orderError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (order.type !== 'TICKET_PURCHASE' || !order.ticket_id) {
      return NextResponse.json({ error: '유효하지 않은 주문 유형입니다.' }, { status: 400 });
    }
    if (order.amount !== amount) {
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
    }

    // 이미 처리된 주문(새로고침 등): 기존 결제 결과로 200 반환하여 성공 페이지가 정상 동작하도록 함
    if (order.status !== 'PENDING') {
      const { data: existingRev } = await (supabase as any)
        .from('revenue_transactions')
        .select('user_ticket_id')
        .eq('toss_order_id', orderId)
        .eq('user_id', order.user_id)
        .maybeSingle();
      if (existingRev?.user_ticket_id) {
        const { data: existingUt } = await (supabase as any)
          .from('user_tickets')
          .select('*')
          .eq('id', existingRev.user_ticket_id)
          .single();
        let existingBooking = null;
        if (order.schedule_id) {
          const { data: b } = await (supabase as any)
            .from('bookings')
            .select('*')
            .eq('user_ticket_id', existingRev.user_ticket_id)
            .eq('schedule_id', order.schedule_id)
            .maybeSingle();
          existingBooking = b;
        }
        // 활동 로그: 이미 처리된 주문에 대한 재호출 (사용자 새로고침 등)
        logTicketEvent({
          academy_id: order.academy_id,
          user_id: order.user_id,
          user_ticket_id: existingRev.user_ticket_id,
          action: 'WEBHOOK_DUPLICATE',
          via: 'webhook',
          reason: 'order_already_processed',
          context: {
            order_id: orderId,
            order_status: order.status,
            previous_user_ticket_id: existingRev.user_ticket_id,
          },
          actor_user_id: authUser?.id ?? null,
        }, supabase).catch(() => {});
        return NextResponse.json(
          {
            success: true,
            data: { userTicket: existingUt || undefined, booking: existingBooking || undefined },
            message: order.schedule_id && existingBooking ? '결제 및 예약이 완료되었습니다.' : '결제가 완료되었습니다.',
          },
          { headers: NO_CACHE_HEADERS }
        );
      }
      return NextResponse.json({ error: '이미 처리된 주문입니다.' }, { status: 400 });
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: '결제 설정이 완료되지 않았습니다.' }, { status: 500 });
    }

    const tossRes = await fetch(TOSS_CONFIRM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossRes.ok) {
      const errData = await tossRes.json().catch(() => ({}));
      console.error('Toss confirm failed:', tossRes.status, errData);
      await (supabase as any)
        .from('user_ticket_payment_orders')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('order_id', orderId);
      // 활동 로그: 결제 실패 (PG 응답 비OK)
      logTicketEvent({
        academy_id: order.academy_id,
        user_id: order.user_id,
        action: 'PAYMENT_FAILED',
        via: 'toss_payment',
        reason: errData?.code || 'toss_confirm_non_ok',
        context: {
          order_id: orderId,
          ticket_id: order.ticket_id,
          amount,
          toss_status: tossRes.status,
          toss_message: errData?.message ?? null,
          toss_code: errData?.code ?? null,
        },
        actor_user_id: authUser?.id ?? null,
      }, supabase).catch(() => {});
      return NextResponse.json(
        { error: errData.message || '결제 승인에 실패했습니다.' },
        { status: 400 }
      );
    }

    const tossPayment = await tossRes.json();
    const paymentMethod = getTossPaymentMethodCode(tossPayment);

    // 멱등성: 이미 처리된 주문(이전 요청에서 revenue 생성 후 크래시 등)이면 중복 생성 없이 기존 결과 반환
    const { data: existingRev } = await (supabase as any)
      .from('revenue_transactions')
      .select('user_ticket_id')
      .eq('toss_order_id', orderId)
      .eq('user_id', order.user_id)
      .maybeSingle();
    if (existingRev?.user_ticket_id) {
      const { data: existingUt } = await (supabase as any)
        .from('user_tickets')
        .select('*')
        .eq('id', existingRev.user_ticket_id)
        .single();
      let existingBooking = null;
      if (order.schedule_id) {
        const { data: b } = await (supabase as any)
          .from('bookings')
          .select('*')
          .eq('user_ticket_id', existingRev.user_ticket_id)
          .eq('schedule_id', order.schedule_id)
          .maybeSingle();
        existingBooking = b;
      }
      await (supabase as any)
        .from('user_ticket_payment_orders')
        .update({ status: 'COMPLETED', toss_payment_key: paymentKey, updated_at: new Date().toISOString() })
        .eq('order_id', orderId);
      // 활동 로그: 멱등 단락 (revenue 가 이미 존재해 중복 발급을 방지)
      logTicketEvent({
        academy_id: order.academy_id,
        user_id: order.user_id,
        user_ticket_id: existingRev.user_ticket_id,
        action: 'WEBHOOK_DUPLICATE',
        via: 'webhook',
        reason: 'revenue_already_exists',
        context: {
          order_id: orderId,
          previous_user_ticket_id: existingRev.user_ticket_id,
          payment_key: paymentKey,
        },
        actor_user_id: authUser?.id ?? null,
      }, supabase).catch(() => {});
      return NextResponse.json(
        {
          success: true,
          data: { userTicket: existingUt || undefined, booking: existingBooking || undefined },
          message: order.schedule_id && existingBooking ? '결제 및 예약이 완료되었습니다.' : '결제가 완료되었습니다.',
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const ticket = await getTicketById(order.ticket_id);
    if (!ticket) {
      return NextResponse.json({ error: '티켓 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const countOpts = (ticket.count_options as { count?: number; price?: number; valid_days?: number | null }[] | null) || [];
    const hasCountOptions = countOpts.length > 0 && (ticket.ticket_category === 'popup' || ticket.access_group === 'popup');
    const optIndex = order.count_option_index ?? 0;
    const selectedOption = hasCountOptions && countOpts[optIndex] ? countOpts[optIndex] : null;
    const optionCount = selectedOption ? (selectedOption.count ?? 1) : (ticket.total_count ?? 1);
    const optionValidDays = selectedOption?.valid_days ?? ticket.valid_days ?? null;
    const isPeriodTicket = checkIsPeriodTicket(ticket.ticket_type);
    const remainingCount = isPeriodTicket ? null : optionCount;

    const startDate = new Date();
    let expiryDateStr: string | null;
    if (optionValidDays != null && optionValidDays > 0) {
      const exp = new Date(startDate);
      exp.setDate(exp.getDate() + optionValidDays);
      expiryDateStr = exp.toISOString().split('T')[0];
    } else if (optionValidDays === null) {
      expiryDateStr = null;
    } else {
      const exp = new Date(startDate);
      exp.setFullYear(exp.getFullYear() + 1);
      expiryDateStr = exp.toISOString().split('T')[0];
    }

    const userTicketData: Database['public']['Tables']['user_tickets']['Insert'] = {
      user_id: order.user_id,
      ticket_id: order.ticket_id,
      remaining_count: remainingCount,
      start_date: startDate.toISOString().split('T')[0],
      expiry_date: expiryDateStr,
      status: 'ACTIVE',
    };

    const { data: userTicket, error: insertError } = await (supabase as any)
      .from('user_tickets')
      .insert(userTicketData)
      .select()
      .single();

    if (insertError) {
      console.error('user_tickets insert error:', insertError);
      return NextResponse.json({ error: '수강권 발급에 실패했습니다.' }, { status: 500 });
    }

    // 활동 로그: 수강권 발급 (토스 결제) — 표준 envelope: before=NULL, after=발급 직후 상태
    logTicketEvent({
      academy_id: order.academy_id,
      user_id: order.user_id,
      user_ticket_id: userTicket.id,
      action: 'TICKET_ISSUED',
      before: { remaining_count: null, status: null, expiry_date: null },
      after: { remaining_count: remainingCount, status: 'ACTIVE', expiry_date: expiryDateStr },
      via: 'toss_payment',
      context: {
        ticket_id: order.ticket_id,
        ticket_name: ticket.name,
        ticket_type: ticket.ticket_type,
        initial_count: remainingCount,
        valid_days: optionValidDays,
        price: amount,
        payment_method: paymentMethod,
        payment_key: paymentKey,
        order_id: orderId,
        start_date: userTicketData.start_date,
      },
      actor_user_id: order.user_id,
    }, supabase).catch(() => {});

    // 동시 요청: 다른 요청이 이미 revenue를 생성했으면 방금 만든 user_ticket 롤백 후 기존 결과 반환
    const { data: existingRev2 } = await (supabase as any)
      .from('revenue_transactions')
      .select('user_ticket_id')
      .eq('toss_order_id', orderId)
      .eq('user_id', order.user_id)
      .maybeSingle();
    if (existingRev2?.user_ticket_id && existingRev2.user_ticket_id !== userTicket.id) {
      await (supabase as any).from('user_tickets').delete().eq('id', userTicket.id);
      const { data: existingUt } = await (supabase as any)
        .from('user_tickets')
        .select('*')
        .eq('id', existingRev2.user_ticket_id)
        .single();
      let existingBooking = null;
      if (order.schedule_id) {
        const { data: b } = await (supabase as any)
          .from('bookings')
          .select('*')
          .eq('user_ticket_id', existingRev2.user_ticket_id)
          .eq('schedule_id', order.schedule_id)
          .maybeSingle();
        existingBooking = b;
      }
      await (supabase as any)
        .from('user_ticket_payment_orders')
        .update({ status: 'COMPLETED', toss_payment_key: paymentKey, updated_at: new Date().toISOString() })
        .eq('order_id', orderId);
      return NextResponse.json(
        {
          success: true,
          data: { userTicket: existingUt || undefined, booking: existingBooking || undefined },
          message: order.schedule_id && existingBooking ? '결제 및 예약이 완료되었습니다.' : '결제가 완료되었습니다.',
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const ticketDisplayName = selectedOption ? `${ticket.name} ${optionCount}회권` : ticket.name;
    const { data: prevTx } = await (supabase as any)
      .from('revenue_transactions')
      .select('id')
      .eq('academy_id', order.academy_id)
      .eq('user_id', order.user_id)
      .eq('payment_status', 'COMPLETED')
      .limit(1);
    const registrationType = prevTx?.length ? 'RE_REGISTRATION' : 'NEW';
    const purchaseQuantity = isPeriodTicket ? 1 : optionCount;

    const transactionDate = new Date().toISOString().split('T')[0];
    const { error: revInsertError } = await (supabase as any)
      .from('revenue_transactions')
      .insert({
        academy_id: order.academy_id,
        user_id: order.user_id,
        ticket_id: order.ticket_id,
        user_ticket_id: userTicket.id,
        discount_id: order.discount_id || null,
        original_price: amount,
        discount_amount: 0,
        final_price: amount,
        payment_method: paymentMethod,
        payment_status: 'COMPLETED',
        registration_type: registrationType,
        quantity: purchaseQuantity,
        valid_days: optionValidDays,
        ticket_name: ticketDisplayName,
        ticket_type_snapshot: ticket.ticket_type,
        toss_payment_key: paymentKey,
        toss_order_id: orderId,
        transaction_date: transactionDate,
        // 토스 결제는 본인이 직접 결제하므로 actor = 구매자 본인
        actor_user_id: order.user_id,
      });

    if (revInsertError) {
      const isDuplicate = revInsertError.code === '23505' || String(revInsertError.message || '').includes('unique');
      if (isDuplicate) {
        const { data: existingRev3 } = await (supabase as any)
          .from('revenue_transactions')
          .select('user_ticket_id')
          .eq('toss_order_id', orderId)
          .eq('user_id', order.user_id)
          .maybeSingle();
        if (existingRev3?.user_ticket_id) {
          await (supabase as any).from('user_tickets').delete().eq('id', userTicket.id);
          const { data: existingUt } = await (supabase as any)
            .from('user_tickets')
            .select('*')
            .eq('id', existingRev3.user_ticket_id)
            .single();
          let existingBooking = null;
          if (order.schedule_id) {
            const { data: b } = await (supabase as any)
              .from('bookings')
              .select('*')
              .eq('user_ticket_id', existingRev3.user_ticket_id)
              .eq('schedule_id', order.schedule_id)
              .maybeSingle();
            existingBooking = b;
          }
          await (supabase as any)
            .from('user_ticket_payment_orders')
            .update({ status: 'COMPLETED', toss_payment_key: paymentKey, updated_at: new Date().toISOString() })
            .eq('order_id', orderId);
          return NextResponse.json(
            {
              success: true,
              data: { userTicket: existingUt || undefined, booking: existingBooking || undefined },
              message: order.schedule_id && existingBooking ? '결제 및 예약이 완료되었습니다.' : '결제가 완료되었습니다.',
            },
            { headers: NO_CACHE_HEADERS }
          );
        }
      }
      console.error('revenue_transactions insert error:', revInsertError);
      await (supabase as any).from('user_tickets').delete().eq('id', userTicket.id);
      return NextResponse.json({ error: '결제 기록 저장에 실패했습니다.' }, { status: 500 });
    }

    const { data: existingStudent } = await (supabase as any)
      .from('academy_students')
      .select('id')
      .eq('academy_id', order.academy_id)
      .eq('user_id', order.user_id)
      .single();
    if (!existingStudent) {
      await (supabase as any)
        .from('academy_students')
        .insert({ academy_id: order.academy_id, user_id: order.user_id });
    }

    let autoBookingResult = { created: 0, skipped: 0 };
    if (isPeriodTicket) {
      try {
        autoBookingResult = await createBookingsForPeriodTicket(
          order.user_id,
          userTicket.id,
          order.ticket_id,
          userTicketData.start_date!,
          userTicketData.expiry_date!
        );
      } catch (e) {
        console.error('Period ticket auto booking error:', e);
      }
    }

    let booking = null;
    if (order.schedule_id) {
      const { data: scheduleRow } = await (supabase as any)
        .from('schedules')
        .select('class_id')
        .eq('id', order.schedule_id)
        .single();
      const resolvedClassId = scheduleRow?.class_id || order.class_id || ticket.class_id;
      if (!resolvedClassId) {
        console.error('Cannot resolve class_id for schedule', order.schedule_id);
      } else {
        const { consumeUserTicket } = await import('@/lib/db/user-tickets');
        let consumeOk = false;
        try {
          // 차감 전 스냅샷 (PERIOD 인 경우 remaining_count 는 null 그대로 유지)
          const beforeRemaining = remainingCount;
          const consumedTicket = await consumeUserTicket(userTicket.id, resolvedClassId, 1, supabase);
          consumeOk = true;
          // 활동 로그: 횟수 차감 (PERIOD 권은 차감이 발생하지 않으므로 로그도 생략)
          if (!isPeriodTicket && consumedTicket && typeof beforeRemaining === 'number') {
            await logTicketEvent({
              academy_id: order.academy_id,
              user_id: order.user_id,
              user_ticket_id: userTicket.id,
              action: 'COUNT_DEDUCT',
              before: { remaining_count: beforeRemaining, status: 'ACTIVE' },
              after: { remaining_count: consumedTicket.remaining_count, status: consumedTicket.status },
              via: 'toss_payment',
              context: { class_id: resolvedClassId, schedule_id: order.schedule_id, order_id: orderId },
              actor_user_id: order.user_id,
            }, supabase).catch(() => {});
          }

          // 활동 로그: 수강권 소진
          if (consumedTicket && consumedTicket.remaining_count === 0 && consumedTicket.status === 'USED') {
            await logTicketEvent({
              academy_id: order.academy_id,
              user_id: order.user_id,
              user_ticket_id: userTicket.id,
              action: 'TICKET_EXHAUSTED',
              before: { remaining_count: 1, status: 'ACTIVE' },
              after: { remaining_count: 0, status: 'USED' },
              via: 'toss_payment',
              context: { class_id: resolvedClassId, schedule_id: order.schedule_id },
              actor_user_id: order.user_id,
            }, supabase).catch(() => {});
          }
        } catch (e: any) {
          console.error('Consume ticket for booking error:', e);
        }
        if (!consumeOk) {
          // 수강권 차감 실패 시 예약 생성하지 않음 (결제는 완료됨, 사용자는 마이페이지에서 직접 예약 가능)
        } else {
        const bookingData: Database['public']['Tables']['bookings']['Insert'] = {
          user_id: order.user_id,
          class_id: resolvedClassId,
          schedule_id: order.schedule_id,
          user_ticket_id: userTicket.id,
          status: 'CONFIRMED',
          payment_status: 'COMPLETED',
        };
        const { data: bookingRow } = await (supabase as any)
          .from('bookings')
          .insert(bookingData)
          .select()
          .single();
        booking = bookingRow;
        if (booking) {
        const { data: confirmedBookings } = await (supabase as any)
          .from('bookings')
          .select('id')
          .eq('schedule_id', order.schedule_id)
          .in('status', ['CONFIRMED', 'COMPLETED']);
        const actualCount = confirmedBookings?.length || 0;
        await (supabase as any)
          .from('schedules')
          .update({ current_students: actualCount })
          .eq('id', order.schedule_id);
        }
        if (booking) {
          insertEnrollmentActivityLog({
            academy_id: order.academy_id,
            user_id: order.user_id,
            user_ticket_id: userTicket.id,
            booking_id: booking.id,
            action: 'ENROLL',
            payload: { schedule_id: order.schedule_id, class_id: resolvedClassId, via: 'payment_confirm' },
            actor_user_id: order.user_id,
          }, supabase).catch(() => {});
        }
        }
      }
    }

    await (supabase as any)
      .from('user_ticket_payment_orders')
      .update({
        status: 'COMPLETED',
        toss_payment_key: paymentKey,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);

    const productType = ticket.is_coupon ? '쿠폰' : '수강권';
    const academyName = ticket.academies?.name_kr || ticket.academies?.name_en || '학원';
    sendNotification({
      user_id: order.user_id,
      type: 'ticket_purchased',
      title: `${productType} 구매 완료`,
      body: `${academyName} ${ticket.name || productType}을(를) 구매하셨습니다.`,
      data: { ticket_id: order.ticket_id, user_ticket_id: userTicket.id, url: '/my/tickets', academy_name: academyName },
      academy_id: order.academy_id,
    }).catch((err) => console.error('[purchase-notification]', err));

    return NextResponse.json(
      {
        success: true,
        data: { userTicket, booking },
        message: order.schedule_id && booking ? '결제 및 예약이 완료되었습니다.' : '결제가 완료되었습니다.',
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (e: any) {
    console.error('payment-confirm error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
