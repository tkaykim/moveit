import { NextResponse } from 'next/server';
import { getTicketById } from '@/lib/db/tickets';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';

/**
 * 수강권 결제용 주문 생성 (Toss Payments 결제창 연동)
 * Body: { ticketId, scheduleId?, countOptionIndex?, discountId? }
 * Returns: { orderId, amount, orderName } → 클라이언트에서 requestPayment(orderId, amount, orderName) 호출
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabase = await getAuthenticatedSupabase(request);
    const body = await request.json();
    const { ticketId, scheduleId, countOptionIndex, discountId } = body;

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId가 필요합니다.' }, { status: 400 });
    }

    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: '티켓을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (!ticket.is_on_sale) {
      return NextResponse.json({ error: '판매 중인 티켓이 아닙니다.' }, { status: 400 });
    }
    if (ticket.is_public === false) {
      return NextResponse.json({ error: '비공개 수강권은 직접 구매할 수 없습니다.' }, { status: 400 });
    }

    const academyId = ticket.academy_id;
    if (!academyId) {
      return NextResponse.json({ error: '학원 정보가 없는 수강권입니다.' }, { status: 400 });
    }

    const countOpts = (ticket.count_options as { count?: number; price?: number; valid_days?: number | null }[] | null) || [];
    const hasCountOptions = countOpts.length > 0 && (ticket.ticket_category === 'popup' || ticket.access_group === 'popup');
    const optIndex = typeof countOptionIndex === 'number' ? countOptionIndex : 0;
    if (hasCountOptions && (optIndex < 0 || optIndex >= countOpts.length)) {
      return NextResponse.json({ error: '유효하지 않은 수강권 옵션입니다.' }, { status: 400 });
    }

    const selectedOption = hasCountOptions && countOpts[optIndex] ? countOpts[optIndex] : null;
    const optionPrice = selectedOption ? (selectedOption.price ?? ticket.price ?? 0) : (ticket.price ?? 0);

    let discountAmount = 0;
    if (discountId) {
      const { data: discountData, error: discountError } = await (supabase as any)
        .from('discounts')
        .select('*')
        .eq('id', discountId)
        .eq('is_active', true)
        .single();
      if (discountError || !discountData) {
        return NextResponse.json({ error: '유효하지 않은 할인정책입니다.' }, { status: 400 });
      }
      const now = new Date().toISOString().split('T')[0];
      if (discountData.valid_from && discountData.valid_from > now) {
        return NextResponse.json({ error: '아직 적용할 수 없는 할인정책입니다.' }, { status: 400 });
      }
      if (discountData.valid_until && discountData.valid_until < now) {
        return NextResponse.json({ error: '만료된 할인정책입니다.' }, { status: 400 });
      }
      if (discountData.academy_id && discountData.academy_id !== academyId) {
        return NextResponse.json({ error: '해당 학원에서 사용할 수 없는 할인정책입니다.' }, { status: 400 });
      }
      if (discountData.discount_type === 'PERCENT') {
        discountAmount = Math.floor(optionPrice * discountData.discount_value / 100);
      } else {
        discountAmount = discountData.discount_value;
      }
      discountAmount = Math.min(discountAmount, optionPrice);
    }

    const amount = Math.max(0, optionPrice - discountAmount);
    if (amount <= 0) {
      return NextResponse.json({ error: '결제 금액이 올바르지 않습니다.' }, { status: 400 });
    }

    let classIdForOrder: string | null = null;
    if (scheduleId) {
      const { data: scheduleRow, error: scheduleErr } = await (supabase as any)
        .from('schedules')
        .select('id, class_id, is_canceled, start_time, classes(academy_id)')
        .eq('id', scheduleId)
        .single();
      if (scheduleErr || !scheduleRow) {
        return NextResponse.json({ error: '유효하지 않은 수업 일정입니다.' }, { status: 400 });
      }
      if (scheduleRow.is_canceled) {
        return NextResponse.json({ error: '취소된 수업에는 예약할 수 없습니다.' }, { status: 400 });
      }
      if (new Date(scheduleRow.start_time) < new Date()) {
        return NextResponse.json({ error: '이미 지난 수업에는 예약할 수 없습니다.' }, { status: 400 });
      }
      const scheduleAcademyId = scheduleRow.classes?.academy_id;
      if (scheduleAcademyId && scheduleAcademyId !== academyId) {
        return NextResponse.json({ error: '선택한 수업이 해당 수강권 학원과 일치하지 않습니다.' }, { status: 400 });
      }
      if (scheduleRow.class_id) {
        classIdForOrder = scheduleRow.class_id;
      }
    }

    const orderId = `tk_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
    const orderName = selectedOption
      ? `${ticket.name} ${selectedOption.count ?? 1}회권`
      : (ticket.name || '수강권');

    const { error: insertError } = await (supabase as any)
      .from('user_ticket_payment_orders')
      .insert({
        order_id: orderId,
        user_id: user.id,
        type: 'TICKET_PURCHASE',
        ticket_id: ticketId,
        academy_id: academyId,
        class_id: classIdForOrder,
        schedule_id: scheduleId || null,
        amount,
        count_option_index: hasCountOptions ? optIndex : null,
        discount_id: discountId || null,
        order_name: orderName,
        status: 'PENDING',
      });

    if (insertError) {
      console.error('payment-order insert error:', insertError);
      return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      orderId,
      amount,
      orderName,
    });
  } catch (e: any) {
    console.error('payment-order error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
