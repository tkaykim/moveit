import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getTicketById } from '@/lib/db/tickets';
import { createBookingsForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { Database } from '@/types/database';

/**
 * POST /api/tickets/purchase-guest
 * 비회원(이름·연락처·이메일만 입력) 수강권 구매. 게스트용 사용자 생성 후 수강권 발급.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any;
    const body = await request.json();
    const { ticketId, startDate: requestedStartDate, guestName, guestPhone, guestEmail } = body;

    if (!ticketId || !guestName || !String(guestName).trim()) {
      return NextResponse.json(
        { error: 'ticketId와 guestName이 필요합니다.' },
        { status: 400 }
      );
    }
    const phone = guestPhone ? String(guestPhone).trim() : null;
    const email = guestEmail ? String(guestEmail).trim() : null;

    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: '수강권을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (!ticket.is_on_sale) {
      return NextResponse.json({ error: '현재 판매 중인 수강권이 아닙니다.' }, { status: 400 });
    }
    if (ticket.is_public === false) {
      return NextResponse.json({ error: '비공개 수강권입니다.' }, { status: 403 });
    }

    let guestUser: { id: string } | null = null;
    if (email) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .limit(1)
        .single();
      if (existing) guestUser = existing;
    }
    if (!guestUser && phone) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .limit(1)
        .single();
      if (existing) guestUser = existing;
    }
    if (!guestUser) {
      const { data: inserted, error: insertUserErr } = await supabase
        .from('users')
        .insert({
          name: String(guestName).trim(),
          phone: phone || null,
          email: email || null,
        })
        .select('id')
        .single();
      if (insertUserErr) {
        console.error(insertUserErr);
        return NextResponse.json({ error: '회원 정보 생성에 실패했습니다.' }, { status: 500 });
      }
      guestUser = inserted;
    }
    if (!guestUser) {
      return NextResponse.json({ error: '게스트 계정을 확인할 수 없습니다.' }, { status: 500 });
    }

    const startDate = requestedStartDate ? new Date(requestedStartDate) : new Date();
    const expiryDate = new Date(startDate);
    if (ticket.valid_days) {
      expiryDate.setDate(expiryDate.getDate() + ticket.valid_days);
    } else {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    const isPeriodTicket = ticket.ticket_type === 'PERIOD';
    const remainingCount = isPeriodTicket ? null : (ticket.total_count || 1);
    const userTicketData: Database['public']['Tables']['user_tickets']['Insert'] = {
      user_id: guestUser.id,
      ticket_id: ticketId,
      remaining_count: remainingCount,
      start_date: startDate.toISOString().split('T')[0],
      expiry_date: expiryDate.toISOString().split('T')[0],
      status: 'ACTIVE',
    };

    const { data: userTicket, error: insertUtErr } = await supabase
      .from('user_tickets')
      .insert(userTicketData)
      .select()
      .single();

    if (insertUtErr) {
      console.error(insertUtErr);
      return NextResponse.json({ error: '수강권 발급에 실패했습니다.' }, { status: 500 });
    }

    if (ticket.academy_id) {
      await supabase.from('revenue_transactions').insert({
        academy_id: ticket.academy_id,
        user_id: guestUser.id,
        ticket_id: ticketId,
        user_ticket_id: userTicket.id,
        original_price: ticket.price ?? 0,
        discount_amount: 0,
        final_price: ticket.price ?? 0,
        payment_method: 'CARD_DEMO',
        payment_status: 'COMPLETED',
      });

      // 학원 학생으로 자동 등록 (중복 방지: 이미 등록된 경우 무시)
      const { data: existingStudent } = await supabase
        .from('academy_students')
        .select('id')
        .eq('academy_id', ticket.academy_id)
        .eq('user_id', guestUser.id)
        .single();

      if (!existingStudent) {
        await supabase
          .from('academy_students')
          .insert({
            academy_id: ticket.academy_id,
            user_id: guestUser.id,
          });
        console.log(`게스트 학원 학생 자동 등록 완료: user_id=${guestUser.id}, academy_id=${ticket.academy_id}`);
      }
    }

    let autoBookingResult = { created: 0, skipped: 0 };
    if (isPeriodTicket) {
      try {
        autoBookingResult = await createBookingsForPeriodTicket(
          guestUser.id,
          userTicket.id,
          ticketId,
          userTicketData.start_date!,
          userTicketData.expiry_date!
        );
      } catch (e) {
        console.error('기간권 자동 예약 생성 오류:', e);
      }
    }

    return NextResponse.json({
      success: true,
      data: { user_ticket: userTicket, user_id: guestUser.id },
      message: `수강권 구매가 완료되었습니다.${isPeriodTicket && autoBookingResult.created > 0 ? ` ${autoBookingResult.created}개 수업이 자동 예약되었습니다.` : ''}`,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
