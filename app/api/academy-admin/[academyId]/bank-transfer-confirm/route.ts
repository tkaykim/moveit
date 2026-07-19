/**
 * POST /api/academy-admin/[academyId]/bank-transfer-confirm
 * Body: { orderId } — bank_transfer_orders.id
 * 학원 관리자가 계좌이체 입금 확인 시 수강권 발급 + (schedule_id 있으면) 예약 확정
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { getTicketById } from '@/lib/db/tickets';
import { createFixedWeeklyBookings } from '@/lib/db/period-ticket-bookings';
import { insertEnrollmentActivityLog, logTicketEvent } from '@/lib/db/enrollment-activity-log';
import { isPeriodTicket as checkIsPeriodTicket } from '@/lib/utils/ticket-type';
import { Database } from '@/types/database';
import { sendNotification } from '@/lib/notifications';

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
      .select('*')
      .eq('id', orderId)
      .eq('academy_id', academyId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (order.status !== 'PENDING') {
      return NextResponse.json({ error: '이미 처리되었거나 대기 중인 주문이 아닙니다.' }, { status: 400 });
    }

    // 멱등성: PENDING → CONFIRMED 원자적 claim.
    // 관리자 더블클릭/요청 재시도로 동시에 두 번 들어와도 하나만 통과 → 수강권·매출 이중발급 차단.
    // (이후 단계 실패 시 아래 에러 분기에서 PENDING 으로 되돌려 재시도 가능하게 함)
    const { data: claimed } = await supabase
      .from('bank_transfer_orders')
      .update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString(), confirmed_by: user.id })
      .eq('id', orderId)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();
    if (!claimed) {
      return NextResponse.json({ error: '이미 처리 중이거나 처리된 주문입니다.' }, { status: 409 });
    }

    const customerUserId = order.user_id;

    // Legacy fallback: B-2 (2026-04-21) 이전에 생성된 주문은 user_id가 null일 수 있음.
    // 이 경우 입금 확인만 처리하고, 수강권 발급은 link-guest-bookings의 Phase 4
    // (issueTicketsForConfirmedOrders)가 회원가입 후 소급 처리.
    // 신규 주문은 bank-transfer-order에서 guest user를 생성하므로 이 분기로 오지 않음.
    if (!customerUserId) {
      await supabase
        .from('bank_transfer_orders')
        .update({
          status: 'CONFIRMED',
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id,
        })
        .eq('id', orderId);

      let confirmedBookingId: string | null = null;
      if (order.schedule_id) {
        const { data: pendingBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('bank_transfer_order_id', orderId)
          .maybeSingle();
        if (pendingBooking) {
          confirmedBookingId = pendingBooking.id;
          await supabase
            .from('bookings')
            .update({ status: 'CONFIRMED', payment_status: 'COMPLETED' })
            .eq('id', pendingBooking.id);
          // current_students 는 bookings 트리거(sync_schedule_student_count)가 자동 동기화한다.
        }
      }

      // 비회원 입금확인 활동 로그
      const guestTicket = await getTicketById(order.ticket_id);
      insertEnrollmentActivityLog({
        academy_id: academyId,
        user_id: null,
        booking_id: confirmedBookingId,
        action: 'ENROLL',
        payload: {
          via: 'bank_transfer_guest_confirm',
          guest_name: order.orderer_name || null,
          guest_phone: order.orderer_phone || null,
          guest_email: order.orderer_email || null,
          ticket_name: guestTicket?.name || order.order_name || null,
          amount: order.amount,
          order_id: orderId,
          schedule_id: order.schedule_id || null,
        },
        actor_user_id: user.id,
      }, supabase).catch(() => {});

      return NextResponse.json({
        success: true,
        data: null,
        message: '비회원 주문은 확인 처리되었습니다. 주문자 연락처로 수강권 수령 방법을 안내해 주세요.',
      });
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
      user_id: customerUserId,
      ticket_id: order.ticket_id,
      remaining_count: remainingCount,
      start_date: startDate.toISOString().split('T')[0],
      expiry_date: expiryDateStr,
      status: 'ACTIVE',
    };

    const { data: userTicket, error: insertError } = await supabase
      .from('user_tickets')
      .insert(userTicketData)
      .select()
      .single();

    if (insertError) {
      console.error('user_tickets insert error:', insertError);
      // claim 되돌리기 → 재시도 가능
      await supabase.from('bank_transfer_orders')
        .update({ status: 'PENDING', confirmed_at: null, confirmed_by: null })
        .eq('id', orderId);
      return NextResponse.json({ error: '수강권 발급에 실패했습니다.' }, { status: 500 });
    }

    // 활동 로그: 수강권 발급 (계좌이체 입금확인) — 표준 envelope
    logTicketEvent({
      academy_id: academyId,
      user_id: customerUserId,
      user_ticket_id: userTicket.id,
      action: 'TICKET_ISSUED',
      before: { remaining_count: null, status: null, expiry_date: null },
      after: { remaining_count: remainingCount, status: 'ACTIVE', expiry_date: expiryDateStr },
      via: 'bank_transfer',
      context: {
        ticket_id: order.ticket_id,
        ticket_name: ticket.name,
        ticket_type: ticket.ticket_type,
        initial_count: remainingCount,
        valid_days: optionValidDays,
        price: order.amount,
        payment_method: 'BANK_TRANSFER',
        order_id: orderId,
        bank_transfer_order_id: orderId,
        start_date: userTicketData.start_date,
      },
      actor_user_id: user.id,
    }, supabase).catch(() => {});

    const ticketDisplayName = selectedOption ? `${ticket.name} ${optionCount}회권` : ticket.name;
    const { data: prevTx } = await supabase
      .from('revenue_transactions')
      .select('id')
      .eq('academy_id', order.academy_id)
      .eq('user_id', customerUserId)
      .eq('payment_status', 'COMPLETED')
      .limit(1);
    const registrationType = prevTx?.length ? 'RE_REGISTRATION' : 'NEW';
    const purchaseQuantity = isPeriodTicket ? 1 : optionCount;
    const transactionDate = new Date().toISOString().split('T')[0];

    const { data: revRow, error: revInsertError } = await supabase
      .from('revenue_transactions')
      .insert({
        academy_id: order.academy_id,
        user_id: customerUserId,
        ticket_id: order.ticket_id,
        user_ticket_id: userTicket.id,
        discount_id: order.discount_id || null,
        original_price: order.amount,
        discount_amount: 0,
        final_price: order.amount,
        payment_method: 'BANK_TRANSFER',
        payment_status: 'COMPLETED',
        registration_type: registrationType,
        quantity: purchaseQuantity,
        valid_days: optionValidDays,
        ticket_name: ticketDisplayName,
        ticket_type_snapshot: ticket.ticket_type,
        transaction_date: transactionDate,
        // 관리자 대행 결제 → actor = 입금 확인을 누른 관리자
        actor_user_id: user.id,
      })
      .select('id')
      .single();

    if (revInsertError) {
      console.error('revenue_transactions insert error:', revInsertError);
      await supabase.from('user_tickets').delete().eq('id', userTicket.id);
      // claim 되돌리기 → 재시도 가능
      await supabase.from('bank_transfer_orders')
        .update({ status: 'PENDING', confirmed_at: null, confirmed_by: null })
        .eq('id', orderId);
      return NextResponse.json({ error: '결제 기록 저장에 실패했습니다.' }, { status: 500 });
    }

    const { data: existingStudent } = await supabase
      .from('academy_students')
      .select('id')
      .eq('academy_id', order.academy_id)
      .eq('user_id', customerUserId)
      .single();
    if (!existingStudent) {
      await supabase
        .from('academy_students')
        .insert({ academy_id: order.academy_id, user_id: customerUserId });
    }

    // 고정 주1회 상품만 자동 예약한다. 일반 PERIOD·ALL PASS 는 0건이다.
    let autoBookingResult = { created: 0, skipped: 0 };
    try {
      const placement = await createFixedWeeklyBookings(userTicket.id);
      autoBookingResult = {
        created: placement.placed,
        skipped: placement.skipped_full + placement.skipped_duplicate,
      };
    } catch (e) {
      console.error('고정 주1회 자동 예약 오류:', e);
    }

    let booking = null;
    if (order.schedule_id) {
      const resolvedClassId = order.class_id || ticket.class_id;
      if (resolvedClassId) {
        const { consumeUserTicket } = await import('@/lib/db/user-tickets');
        let consumeOk = false;
        let consumedTicket: any = null;
        try {
          const beforeRemaining = remainingCount;
          consumedTicket = await consumeUserTicket(userTicket.id, resolvedClassId, 1, supabase);
          consumeOk = true;
          // 활동 로그: 횟수 차감 (PERIOD 권은 차감이 없으므로 로그 생략)
          if (!isPeriodTicket && consumedTicket && typeof beforeRemaining === 'number') {
            await logTicketEvent({
              academy_id: academyId,
              user_id: customerUserId,
              user_ticket_id: userTicket.id,
              action: 'COUNT_DEDUCT',
              before: { remaining_count: beforeRemaining, status: 'ACTIVE' },
              after: { remaining_count: consumedTicket.remaining_count, status: consumedTicket.status },
              via: 'bank_transfer',
              context: { class_id: resolvedClassId, schedule_id: order.schedule_id, order_id: orderId },
              actor_user_id: user.id,
            }, supabase).catch(() => {});
          }

          // 활동 로그: 수강권 소진
          if (consumedTicket && consumedTicket.remaining_count === 0 && consumedTicket.status === 'USED') {
            await logTicketEvent({
              academy_id: academyId,
              user_id: customerUserId,
              user_ticket_id: userTicket.id,
              action: 'TICKET_EXHAUSTED',
              before: { remaining_count: 1, status: 'ACTIVE' },
              after: { remaining_count: 0, status: 'USED' },
              via: 'bank_transfer',
              context: { class_id: resolvedClassId, schedule_id: order.schedule_id },
              actor_user_id: user.id,
            }, supabase).catch(() => {});
          }
        } catch (e: any) {
          console.error('Consume ticket for booking error:', e);
        }
        if (consumeOk) {
          // 계좌이체 신청 시 선생성된 booking이 있으면 업데이트, 없으면(레거시) 새로 생성
          const { data: existingBooking } = await supabase
            .from('bookings')
            .select('id, status')
            .eq('bank_transfer_order_id', orderId)
            .maybeSingle();

          if (existingBooking) {
            // 이미 출석/결석 처리된 booking은 status를 되돌리지 않음 (역주행 방지)
            const alreadyAttended = ['COMPLETED', 'ABSENT'].includes(existingBooking.status);
            const { data: updatedRow, error: updateBookingErr } = await supabase
              .from('bookings')
              .update({
                ...(alreadyAttended ? {} : { status: 'CONFIRMED' }),
                user_ticket_id: userTicket.id,
                payment_status: 'COMPLETED',
              })
              .eq('id', existingBooking.id)
              .select()
              .single();
            if (updateBookingErr) {
              console.error('bank-transfer booking update error:', updateBookingErr);
              if (!isPeriodTicket) {
                try {
                  const { data: restored } = await supabase
                    .rpc('restore_ticket_count', { p_user_ticket_id: userTicket.id, p_count: 1 });
                  const restoredRow = Array.isArray(restored) ? restored[0] : restored;
                  await logTicketEvent({
                    academy_id: academyId,
                    user_id: customerUserId,
                    user_ticket_id: userTicket.id,
                    action: 'COUNT_RESTORE',
                    before: { remaining_count: consumedTicket?.remaining_count ?? null, status: consumedTicket?.status ?? null },
                    after: {
                      remaining_count: restoredRow?.remaining_count ?? remainingCount,
                      status: restoredRow?.status ?? 'ACTIVE',
                    },
                    via: 'bank_transfer',
                    reason: 'booking_update_failed',
                    context: { class_id: resolvedClassId, schedule_id: order.schedule_id, order_id: orderId },
                    actor_user_id: user.id,
                  }, supabase).catch(() => {});
                } catch (rollbackError) {
                  console.error('bank-transfer ticket restore after booking update error failed:', rollbackError);
                }
              }
            }
            booking = updatedRow;
          } else {
            const { data: scheduleRow } = await supabase
              .from('schedules')
              .select('class_id')
              .eq('id', order.schedule_id)
              .single();
            const classId = scheduleRow?.class_id || resolvedClassId;
            const bookingData: Database['public']['Tables']['bookings']['Insert'] = {
              user_id: customerUserId,
              class_id: classId,
              schedule_id: order.schedule_id,
              user_ticket_id: userTicket.id,
              status: 'CONFIRMED',
              payment_status: 'COMPLETED',
            };
            const { data: bookingRow, error: bookingInsErr } = await supabase
              .from('bookings')
              .insert(bookingData)
              .select()
              .single();
            if (bookingInsErr) {
              // 수강권은 이미 발급됨(유효). 예약만 실패 → 거짓 "예약 확정" 메시지 방지 위해 booking=null 유지.
              console.error('bank-transfer booking insert error:', bookingInsErr);
              if (!isPeriodTicket) {
                try {
                  const { data: restored } = await supabase
                    .rpc('restore_ticket_count', { p_user_ticket_id: userTicket.id, p_count: 1 });
                  const restoredRow = Array.isArray(restored) ? restored[0] : restored;
                  await logTicketEvent({
                    academy_id: academyId,
                    user_id: customerUserId,
                    user_ticket_id: userTicket.id,
                    action: 'COUNT_RESTORE',
                    before: { remaining_count: consumedTicket?.remaining_count ?? null, status: consumedTicket?.status ?? null },
                    after: {
                      remaining_count: restoredRow?.remaining_count ?? remainingCount,
                      status: restoredRow?.status ?? 'ACTIVE',
                    },
                    via: 'bank_transfer',
                    reason: 'booking_insert_failed',
                    context: { class_id: resolvedClassId, schedule_id: order.schedule_id, order_id: orderId },
                    actor_user_id: user.id,
                  }, supabase).catch(() => {});
                } catch (rollbackError) {
                  console.error('bank-transfer ticket restore after booking insert error failed:', rollbackError);
                }
              }
            }
            booking = bookingRow;
          }
          if (booking) {
            // current_students 는 bookings 트리거(sync_schedule_student_count)가 자동 동기화한다.

            // 활동 로그: 수강신청 (계좌이체 확인)
            insertEnrollmentActivityLog({
              academy_id: academyId,
              user_id: customerUserId,
              user_ticket_id: userTicket.id,
              booking_id: booking.id,
              action: 'ENROLL',
              payload: { schedule_id: order.schedule_id, class_id: resolvedClassId, via: 'bank_transfer' },
              actor_user_id: user.id,
            }, supabase).catch(() => {});
          }
        }
      }
    }

    await supabase
      .from('bank_transfer_orders')
      .update({
        status: 'CONFIRMED',
        user_ticket_id: userTicket.id,
        revenue_transaction_id: revRow.id,
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,
      })
      .eq('id', orderId);

    const productType = ticket.is_coupon ? '쿠폰' : '수강권';
    const academyName = ticket.academies?.name_kr || ticket.academies?.name_en || '학원';
    sendNotification({
      user_id: customerUserId,
      type: 'ticket_purchased',
      title: `${productType} 구매 완료 (입금 확인)`,
      body: `${academyName} ${ticket.name || productType} 입금이 확인되어 발급되었습니다.`,
      data: { ticket_id: order.ticket_id, user_ticket_id: userTicket.id, url: '/my/tickets', academy_name: academyName },
      academy_id: order.academy_id,
    }).catch((err) => console.error('[bank-transfer-confirm notification]', err));

    return NextResponse.json({
      success: true,
      data: { userTicket, booking },
      message: order.schedule_id && booking ? '입금 확인 완료. 수강권 발급 및 예약이 확정되었습니다.' : '입금 확인 완료. 수강권이 발급되었습니다.',
    });
  } catch (e: any) {
    if (e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('bank-transfer-confirm error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
