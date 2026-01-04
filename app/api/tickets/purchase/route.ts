import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getTicketById } from '@/lib/db/tickets';
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
      const { data: demoUsersList } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (demoUsersList && demoUsersList.length > 0) {
        user = { id: demoUsersList[0].id };
      } else {
        // 사용자가 없으면 임시 UUID 사용 (데모용)
        user = { id: '7db26cd6-ae42-42ee-8a56-8c3fec8be7a3' };
      }
    } else {
      user = authUser;
    }

    const { ticketId } = await request.json();

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

    // 유효기간 계산
    const startDate = new Date();
    const expiryDate = new Date(startDate);
    
    if (ticket.valid_days) {
      expiryDate.setDate(expiryDate.getDate() + ticket.valid_days);
    } else {
      // valid_days가 없으면 기본값으로 1년 설정
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    // user_tickets에 레코드 생성
    const userTicketData: Database['public']['Tables']['user_tickets']['Insert'] = {
      user_id: user.id,
      ticket_id: ticketId,
      remaining_count: ticket.total_count || 0,
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

    return NextResponse.json({
      success: true,
      data: userTicket,
      message: '수강권 구매가 완료되었습니다.',
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

