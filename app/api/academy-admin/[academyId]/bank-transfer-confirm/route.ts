/**
 * POST /api/academy-admin/[academyId]/bank-transfer-confirm
 * Body: { orderId } — bank_transfer_orders.id
 * 학원 관리자가 계좌이체 입금 확인 시 수강권 발급 + (schedule_id 있으면) 예약 확정
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getTicketById } from '@/lib/db/tickets';
import { createBookingsForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { Database } from '@/types/database';
import { sendNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

async function assertAcademyAdmin(academyId: string, userId: string) {
  const supabase = createServiceClient();
  const { data: userData } = await (supabase as any)
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  const isSuperAdmin = userData?.role === 'SUPER_ADMIN';
  if (isSuperAdmin) return;
  const { data: roleData, error: roleError } = await (supabase as any)
    .from('academy_user_roles')
    .select('role')
    .eq('academy_id', academyId)
    .eq('user_id', userId)
    .single();
  if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
    throw new Error('학원 관리자 권한이 필요합니다.');
  }
}

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

    const customerUserId = order.user_id;
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
    const isPeriodTicket = ticket.ticket_type === 'PERIOD';
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
      return NextResponse.json({ error: '수강권 발급에 실패했습니다.' }, { status: 500 });
    }

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
      })
      .select('id')
      .single();

    if (revInsertError) {
      console.error('revenue_transactions insert error:', revInsertError);
      await supabase.from('user_tickets').delete().eq('id', userTicket.id);
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

    let autoBookingResult = { created: 0, skipped: 0 };
    if (isPeriodTicket) {
      try {
        autoBookingResult = await createBookingsForPeriodTicket(
          customerUserId,
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
      const { data: scheduleRow } = await supabase
        .from('schedules')
        .select('class_id')
        .eq('id', order.schedule_id)
        .single();
      const resolvedClassId = scheduleRow?.class_id || order.class_id || ticket.class_id;
      if (resolvedClassId) {
        const { consumeUserTicket } = await import('@/lib/db/user-tickets');
        let consumeOk = false;
        try {
          await consumeUserTicket(userTicket.id, resolvedClassId, 1);
          consumeOk = true;
        } catch (e: any) {
          console.error('Consume ticket for booking error:', e);
        }
        if (consumeOk) {
          const bookingData: Database['public']['Tables']['bookings']['Insert'] = {
            user_id: customerUserId,
            class_id: resolvedClassId,
            schedule_id: order.schedule_id,
            user_ticket_id: userTicket.id,
            status: 'CONFIRMED',
            payment_status: 'COMPLETED',
          };
          const { data: bookingRow } = await supabase
            .from('bookings')
            .insert(bookingData)
            .select()
            .single();
          booking = bookingRow;
          if (booking) {
            const { data: confirmedBookings } = await supabase
              .from('bookings')
              .select('id')
              .eq('schedule_id', order.schedule_id)
              .in('status', ['CONFIRMED', 'COMPLETED']);
            const actualCount = confirmedBookings?.length || 0;
            await supabase
              .from('schedules')
              .update({ current_students: actualCount })
              .eq('id', order.schedule_id);
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
