import { NextResponse } from 'next/server';
import { getTicketById } from '@/lib/db/tickets';
import { createBookingsForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';
import { Database } from '@/types/database';
import { sendNotification } from '@/lib/notifications';

// 수강권 구매 (쿠키 또는 Authorization Bearer 토큰)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const supabase = await getAuthenticatedSupabase(request);

    const { ticketId, startDate: requestedStartDate, discountId, paymentMethod, countOptionIndex } = await request.json();

    if (!ticketId) {
      return NextResponse.json(
        { error: 'ticketId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 티켓 정보 조회
    const ticket = await getTicketById(ticketId);

    if (!ticket) {
      return NextResponse.json(
        { error: '티켓을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 티켓이 판매 중인지 확인
    if (!ticket.is_on_sale) {
      return NextResponse.json(
        { error: '판매 중인 티켓이 아닙니다.' },
        { status: 400 }
      );
    }

    // 비공개 수강권은 사용자 직접 구매 불가
    if (ticket.is_public === false) {
      return NextResponse.json(
        { error: '비공개 수강권은 직접 구매할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 쿠폰제 count_options: 옵션별 count, price, valid_days (할인/최종가 계산 전에 먼저 결정)
    const countOpts = (ticket.count_options as { count?: number; price?: number; valid_days?: number | null }[] | null) || [];
    const hasCountOptions = countOpts.length > 0 && (ticket.ticket_category === 'popup' || ticket.access_group === 'popup');
    
    // countOptionIndex 범위 검증
    if (hasCountOptions && typeof countOptionIndex === 'number') {
      if (countOptionIndex < 0 || countOptionIndex >= countOpts.length) {
        return NextResponse.json(
          { error: '유효하지 않은 수강권 옵션입니다.' },
          { status: 400 }
        );
      }
    }
    
    const optIndex = typeof countOptionIndex === 'number' ? countOptionIndex : 0;
    const selectedOption = hasCountOptions && countOpts[optIndex] ? countOpts[optIndex] : null;
    const optionCount = selectedOption ? (selectedOption.count ?? 1) : (ticket.total_count ?? 1);
    const optionPrice = selectedOption ? (selectedOption.price ?? ticket.price ?? 0) : (ticket.price ?? 0);
    const optionValidDays = selectedOption?.valid_days ?? ticket.valid_days ?? null;

    let discountAmount = 0;
    let appliedDiscount = null;

    if (discountId) {
      const { data: discountData, error: discountError } = await (supabase as any)
        .from('discounts')
        .select('*')
        .eq('id', discountId)
        .eq('is_active', true)
        .single();

      if (discountError || !discountData) {
        return NextResponse.json(
          { error: '유효하지 않은 할인정책입니다.' },
          { status: 400 }
        );
      }

      const now = new Date().toISOString().split('T')[0];
      if (discountData.valid_from && discountData.valid_from > now) {
        return NextResponse.json(
          { error: '아직 적용할 수 없는 할인정책입니다.' },
          { status: 400 }
        );
      }
      if (discountData.valid_until && discountData.valid_until < now) {
        return NextResponse.json(
          { error: '만료된 할인정책입니다.' },
          { status: 400 }
        );
      }
      if (discountData.academy_id && discountData.academy_id !== ticket.academy_id) {
        return NextResponse.json(
          { error: '해당 학원에서 사용할 수 없는 할인정책입니다.' },
          { status: 400 }
        );
      }

      if (discountData.discount_type === 'PERCENT') {
        discountAmount = Math.floor(optionPrice * discountData.discount_value / 100);
      } else {
        discountAmount = discountData.discount_value;
      }
      discountAmount = Math.min(discountAmount, optionPrice);
      appliedDiscount = discountData;
    }
    const originalPrice = optionPrice;
    const finalPrice = Math.max(0, originalPrice - discountAmount);

    const isPeriodTicket = ticket.ticket_type === 'PERIOD';
    const remainingCount = isPeriodTicket ? null : optionCount;

    // 유효기간 계산 - 사용자가 시작일을 지정한 경우 해당 날짜 사용
    const startDate = requestedStartDate ? new Date(requestedStartDate) : new Date();
    let expiryDateStr: string | null;
    if (optionValidDays != null && optionValidDays > 0) {
      const exp = new Date(startDate);
      exp.setDate(exp.getDate() + optionValidDays);
      expiryDateStr = exp.toISOString().split('T')[0];
    } else if (optionValidDays === null) {
      // 횟수권 무제한(valid_days: null)
      expiryDateStr = null;
    } else {
      // 기간권 또는 valid_days 미설정: 기본 1년
      const exp = new Date(startDate);
      exp.setFullYear(exp.getFullYear() + 1);
      expiryDateStr = exp.toISOString().split('T')[0];
    }

    const userTicketData: Database['public']['Tables']['user_tickets']['Insert'] = {
      user_id: user.id,
      ticket_id: ticketId,
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
      console.error('Error creating user ticket:', insertError);
      return NextResponse.json(
        { error: '수강권 구매에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 거래 기록 생성 (revenue_transactions) 및 학원 학생 등록
    if (ticket.academy_id) {
      // 카드결제인 경우 데모 결제로 처리
      const finalPaymentMethod = paymentMethod === 'card' ? 'CARD_DEMO' : (paymentMethod || 'TEST');

      // 신규/재등록 판별: 해당 학원에서 이전 결제 기록이 있으면 재등록
      const { data: prevTx } = await (supabase as any)
        .from('revenue_transactions')
        .select('id')
        .eq('academy_id', ticket.academy_id)
        .eq('user_id', user.id)
        .eq('payment_status', 'COMPLETED')
        .limit(1);

      const registrationType = (prevTx && prevTx.length > 0) ? 'RE_REGISTRATION' : 'NEW';
      const purchaseQuantity = isPeriodTicket ? 1 : optionCount;
      
      // 구매 시점 상품명 스냅샷 생성
      const ticketDisplayName = selectedOption
        ? `${ticket.name} ${optionCount}회권`
        : ticket.name;

      await (supabase as any)
        .from('revenue_transactions')
        .insert({
          academy_id: ticket.academy_id,
          user_id: user.id,
          ticket_id: ticketId,
          user_ticket_id: userTicket.id,
          discount_id: appliedDiscount?.id || null,
          original_price: originalPrice,
          discount_amount: discountAmount,
          final_price: finalPrice,
          payment_method: finalPaymentMethod,
          payment_status: 'COMPLETED',
          registration_type: registrationType,
          quantity: purchaseQuantity,
          valid_days: optionValidDays,
          ticket_name: ticketDisplayName,
          ticket_type_snapshot: ticket.ticket_type,
        });

      // 학원 학생으로 자동 등록 (중복 방지: 이미 등록된 경우 무시)
      const { data: existingStudent } = await (supabase as any)
        .from('academy_students')
        .select('id')
        .eq('academy_id', ticket.academy_id)
        .eq('user_id', user.id)
        .single();

      if (!existingStudent) {
        await (supabase as any)
          .from('academy_students')
          .insert({
            academy_id: ticket.academy_id,
            user_id: user.id,
          });
        console.log(`학원 학생 자동 등록 완료: user_id=${user.id}, academy_id=${ticket.academy_id}`);
      }
    }

    // 기간권(PERIOD)인 경우: 해당 기간 내 스케줄 자동 예약 생성
    let autoBookingResult = { created: 0, skipped: 0, scheduleIds: [] as string[] };
    
    if (isPeriodTicket) {
      try {
        autoBookingResult = await createBookingsForPeriodTicket(
          user.id,
          userTicket.id,
          ticketId,
          userTicketData.start_date!,
          userTicketData.expiry_date!
        );
        
        console.log(`기간권 자동 예약 생성 완료: ${autoBookingResult.created}개 생성, ${autoBookingResult.skipped}개 스킵`);
      } catch (bookingError) {
        console.error('기간권 자동 예약 생성 오류:', bookingError);
        // 자동 예약 실패해도 수강권 구매는 성공으로 처리
      }
    }

    // 수강권/쿠폰 구분 메시지
    const productType = ticket.is_coupon ? '쿠폰' : '수강권';
    
    // 기간권인 경우 자동 예약 정보도 포함
    const message = isPeriodTicket && autoBookingResult.created > 0
      ? `${productType} 구매가 완료되었습니다. ${autoBookingResult.created}개의 수업이 자동 예약되었습니다.`
      : `${productType} 구매가 완료되었습니다.`;

    // 푸시 알림 발송 (비동기, 실패해도 구매는 성공)
    const academyName = ticket.academies?.name_kr || ticket.academies?.name_en || '학원';
    const ticketDisplayName = ticket.name || productType;
    
    let purchaseBody = `${academyName} ${ticketDisplayName}을(를) 구매하셨습니다.`;
    if (isPeriodTicket && autoBookingResult.created > 0) {
      purchaseBody += ` ${autoBookingResult.created}개 수업이 자동 예약되었습니다.`;
    } else if (!isPeriodTicket && remainingCount) {
      purchaseBody += ` 잔여 횟수: ${remainingCount}회`;
    }
    
    sendNotification({
      user_id: user.id,
      type: 'ticket_purchased',
      title: `${productType} 구매 완료`,
      body: purchaseBody,
      data: { ticket_id: ticketId, user_ticket_id: userTicket?.id, url: '/my/tickets' },
      academy_id: ticket.academy_id,
    }).catch((err) => console.error('[purchase-notification]', err));

    return NextResponse.json({
      success: true,
      data: userTicket,
      payment: {
        originalPrice,
        discountAmount,
        finalPrice,
        discountApplied: !!appliedDiscount,
      },
      autoBooking: isPeriodTicket ? {
        created: autoBookingResult.created,
        skipped: autoBookingResult.skipped,
      } : undefined,
      message,
      demo: false,
    });
  } catch (error: any) {
    console.error('Error in ticket purchase API:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

