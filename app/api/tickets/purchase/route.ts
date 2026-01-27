import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getTicketById } from '@/lib/db/tickets';
import { createBookingsForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { Database } from '@/types/database';

// 수강권 구매
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 현재 사용자 확인 (데모 버전: 인증 우회)
    let user: any = null;
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      // 데모 버전: 인증 없이도 진행 (임시 사용자 ID 사용)
      // 실제 프로덕션에서는 이 부분을 제거해야 함
      // 조회 API와 동일한 순서로 사용자 선택 (created_at ASC)
      const result = await supabase
        .from('users')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1);
      const demoUsersList = result.data as Array<{ id: string }> | null;
      
      if (demoUsersList && demoUsersList.length > 0) {
        user = { id: demoUsersList[0].id };
      } else {
        // 사용자가 없으면 임시 UUID 사용 (데모용)
        user = { id: '7db26cd6-ae42-42ee-8a56-8c3fec8be7a3' };
      }
    } else {
      user = authUser;
    }

    const { ticketId, startDate: requestedStartDate, discountId, paymentMethod } = await request.json();

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

    // 할인정책 적용 처리
    let discountAmount = 0;
    let appliedDiscount = null;

    if (discountId) {
      // 할인정책 유효성 검증
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

      // 할인 유효기간 체크
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

      // 학원 할인인 경우 학원 ID 체크
      if (discountData.academy_id && discountData.academy_id !== ticket.academy_id) {
        return NextResponse.json(
          { error: '해당 학원에서 사용할 수 없는 할인정책입니다.' },
          { status: 400 }
        );
      }

      // 할인 금액 계산
      if (discountData.discount_type === 'PERCENT') {
        discountAmount = Math.floor(ticket.price * discountData.discount_value / 100);
      } else {
        discountAmount = discountData.discount_value;
      }

      // 할인 금액이 원가를 초과할 수 없음
      discountAmount = Math.min(discountAmount, ticket.price);
      appliedDiscount = discountData;
    }

    const originalPrice = ticket.price;
    const finalPrice = originalPrice - discountAmount;

    // 유효기간 계산 - 사용자가 시작일을 지정한 경우 해당 날짜 사용
    const startDate = requestedStartDate ? new Date(requestedStartDate) : new Date();
    const expiryDate = new Date(startDate);
    
    if (ticket.valid_days) {
      expiryDate.setDate(expiryDate.getDate() + ticket.valid_days);
    } else {
      // valid_days가 없으면 기본값으로 1년 설정
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    // user_tickets에 레코드 생성
    // 기간권(PERIOD): remaining_count = null (횟수 무제한, 기간으로만 관리)
    // 횟수권(COUNT): remaining_count = total_count (횟수 차감)
    const isPeriodTicket = ticket.ticket_type === 'PERIOD';
    const remainingCount = isPeriodTicket ? null : (ticket.total_count || 1);
    
    const userTicketData: Database['public']['Tables']['user_tickets']['Insert'] = {
      user_id: user.id,
      ticket_id: ticketId,
      remaining_count: remainingCount,
      start_date: startDate.toISOString().split('T')[0], // YYYY-MM-DD 형식
      expiry_date: expiryDate.toISOString().split('T')[0], // YYYY-MM-DD 형식
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

    // 거래 기록 생성 (revenue_transactions)
    if (ticket.academy_id) {
      // 카드결제인 경우 데모 결제로 처리
      const finalPaymentMethod = paymentMethod === 'card' ? 'CARD_DEMO' : (paymentMethod || 'TEST');
      
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
          payment_method: finalPaymentMethod, // 데모 결제 방법
          payment_status: 'COMPLETED', // 데모 결제는 즉시 완료 처리
        });
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
      demo: !authUser, // 데모 모드인지 표시
    });
  } catch (error: any) {
    console.error('Error in ticket purchase API:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

