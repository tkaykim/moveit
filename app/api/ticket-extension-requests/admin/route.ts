import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createBookingsForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { getSchedulesForPeriodTicket } from '@/lib/db/period-ticket-bookings';

/**
 * POST: 관리자 직접 연장/일시정지 생성 및 즉시 승인
 * Body: { academyId, user_ticket_id, request_type: 'EXTENSION'|'PAUSE', absent_start_date, absent_end_date }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any;
    const { data: { session } } = await supabase.auth.getSession();
    let adminUser = session?.user ?? null;
    if (!adminUser) {
      const { data: { user } } = await supabase.auth.getUser();
      adminUser = user;
    }
    if (!adminUser) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { academyId, user_ticket_id, request_type, absent_start_date, absent_end_date } = body;
    if (!academyId || !user_ticket_id || !request_type || !absent_start_date || !absent_end_date) {
      return NextResponse.json(
        { error: 'academyId, user_ticket_id, request_type, absent_start_date, absent_end_date 가 필요합니다.' },
        { status: 400 }
      );
    }
    if (!['EXTENSION', 'PAUSE'].includes(request_type)) {
      return NextResponse.json({ error: 'request_type는 EXTENSION 또는 PAUSE 여야 합니다.' }, { status: 400 });
    }

    const start = new Date(absent_start_date);
    const end = new Date(absent_end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: '유효한 absent 기간(시작일~종료일)을 입력해주세요.' }, { status: 400 });
    }

    const { data: userTicket, error: utError } = await supabase
      .from('user_tickets')
      .select('id, user_id, ticket_id, expiry_date, tickets(academy_id, ticket_type)')
      .eq('id', user_ticket_id)
      .single();
    if (utError || !userTicket) {
      return NextResponse.json({ error: '수강권을 찾을 수 없습니다.' }, { status: 404 });
    }
    const ticketAcademyId = userTicket.tickets?.academy_id;
    if (!ticketAcademyId || ticketAcademyId !== academyId) {
      return NextResponse.json({ error: '해당 학원의 수강권이 아닙니다.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from('ticket_extension_requests')
      .insert({
        user_ticket_id,
        request_type,
        absent_start_date,
        absent_end_date,
        status: 'APPROVED',
        processed_at: now,
        processed_by: adminUser.id,
        updated_at: now,
      })
      .select()
      .single();
    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: '등록에 실패했습니다.' }, { status: 500 });
    }

    // 즉시 반영: 만료일 연장 및 기간권 예약 재생성
    if (userTicket.expiry_date) {
      const addDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const currentExpiry = new Date(userTicket.expiry_date);
      const newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + addDays);
      const newExpiryStr = newExpiry.toISOString().slice(0, 10);

      await supabase
        .from('user_tickets')
        .update({ expiry_date: newExpiryStr })
        .eq('id', user_ticket_id);

      const ticketType = userTicket.tickets?.ticket_type;
      const ticketId = userTicket.ticket_id;
      const userId = userTicket.user_id;

      if (ticketType === 'PERIOD' && ticketId && userId) {
        const schedulesInAbsent = await getSchedulesForPeriodTicket(ticketId, absent_start_date, absent_end_date);
        for (const sch of schedulesInAbsent || []) {
          const { data: toCancel } = await supabase
            .from('bookings')
            .select('id')
            .eq('user_ticket_id', user_ticket_id)
            .eq('schedule_id', sch.id)
            .in('status', ['CONFIRMED', 'PENDING']);
          if (toCancel?.length) {
            await supabase.from('bookings').update({ status: 'CANCELLED' }).in('id', toCancel.map((b: any) => b.id));
            const cur = (sch as any).current_students ?? 0;
            await supabase.from('schedules').update({ current_students: Math.max(0, cur - toCancel.length) }).eq('id', sch.id);
          }
        }
        const extendStart = new Date(currentExpiry);
        extendStart.setDate(extendStart.getDate() + 1);
        const extendStartStr = extendStart.toISOString().slice(0, 10);
        await createBookingsForPeriodTicket(userId, user_ticket_id, ticketId, extendStartStr, newExpiryStr);
      }
    }

    return NextResponse.json({ data: inserted });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
