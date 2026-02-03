import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createBookingsForPeriodTicket } from '@/lib/db/period-ticket-bookings';
import { getSchedulesForPeriodTicket } from '@/lib/db/period-ticket-bookings';

/**
 * PATCH: 연장/일시정지 신청 승인 또는 거절 (관리자)
 * Body: { status: 'APPROVED' | 'REJECTED', reject_reason?: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient() as any;
    const body = await request.json();
    const { status, reject_reason } = body;
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'status는 APPROVED 또는 REJECTED 여야 합니다.' },
        { status: 400 }
      );
    }
    if (status === 'REJECTED' && typeof reject_reason !== 'string') {
      return NextResponse.json(
        { error: '거절 시 reject_reason을 입력해주세요.' },
        { status: 400 }
      );
    }

    const { data: reqRow, error: fetchErr } = await supabase
      .from('ticket_extension_requests')
      .select('*, user_tickets(id, user_id, expiry_date, ticket_id, tickets(ticket_type))')
      .eq('id', id)
      .single();
    if (fetchErr || !reqRow) {
      return NextResponse.json({ error: '신청을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (reqRow.status !== 'PENDING') {
      return NextResponse.json({ error: '이미 처리된 신청입니다.' }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from('ticket_extension_requests')
      .update({
        status,
        reject_reason: status === 'REJECTED' ? (reject_reason || null) : null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateErr) throw updateErr;

    if (status === 'APPROVED' && reqRow.user_tickets?.expiry_date) {
      const start = new Date(reqRow.absent_start_date);
      const end = new Date(reqRow.absent_end_date);
      const addDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const currentExpiry = new Date(reqRow.user_tickets.expiry_date);
      const newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + addDays);
      const newExpiryStr = newExpiry.toISOString().slice(0, 10);
      const oldExpiryStr = reqRow.user_tickets.expiry_date;

      await supabase
        .from('user_tickets')
        .update({ expiry_date: newExpiryStr })
        .eq('id', reqRow.user_ticket_id);

      const ticketType = reqRow.user_tickets?.tickets?.ticket_type;
      const ticketId = reqRow.user_tickets?.ticket_id;
      const userId = reqRow.user_tickets?.user_id;

      if (ticketType === 'PERIOD' && ticketId && userId) {
        const absentStart = reqRow.absent_start_date;
        const absentEnd = reqRow.absent_end_date;
        const schedulesInAbsent = await getSchedulesForPeriodTicket(ticketId, absentStart, absentEnd);
        for (const sch of schedulesInAbsent || []) {
          const { data: toCancel } = await supabase
            .from('bookings')
            .select('id')
            .eq('user_ticket_id', reqRow.user_ticket_id)
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
        await createBookingsForPeriodTicket(userId, reqRow.user_ticket_id, ticketId, extendStartStr, newExpiryStr);
      }
    }

    const { data: updated } = await supabase
      .from('ticket_extension_requests')
      .select('*')
      .eq('id', id)
      .single();
    return NextResponse.json({ data: updated });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
