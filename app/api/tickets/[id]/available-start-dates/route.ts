import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getSchedulesForPeriodTicket } from '@/lib/db/period-ticket-bookings';

/**
 * GET /api/tickets/[id]/available-start-dates
 * 기간제 수강권의 "시작일"로 선택 가능한 날짜 목록 (연결된 수업이 있는 날만)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;
    const supabase = await createClient() as any;
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, ticket_type')
      .eq('id', ticketId)
      .single();
    if (!ticket || ticket.ticket_type !== 'PERIOD') {
      return NextResponse.json({ data: [] });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() + 1);
    const end = new Date(today);
    end.setDate(end.getDate() + 90);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const schedules = await getSchedulesForPeriodTicket(ticketId, startStr, endStr);
    const dateSet = new Set<string>();
    (schedules || []).forEach((s: any) => {
      const t = s.start_time;
      if (t) dateSet.add(t.slice(0, 10));
    });
    const dates = Array.from(dateSet).sort();
    return NextResponse.json({ data: dates });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
