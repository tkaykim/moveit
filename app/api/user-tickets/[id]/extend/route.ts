import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST: 관리자 임의 연장
 * Body: { extend_days: number } 또는 { new_expiry_date: 'YYYY-MM-DD' }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userTicketId } = await params;
    const supabase = await createClient() as any;
    const body = await request.json();
    const { extend_days, new_expiry_date } = body;

    const { data: ut, error: fetchErr } = await supabase
      .from('user_tickets')
      .select('id, expiry_date, ticket_id, tickets(academy_id)')
      .eq('id', userTicketId)
      .single();
    if (fetchErr || !ut) {
      return NextResponse.json({ error: '수강권을 찾을 수 없습니다.' }, { status: 404 });
    }

    let nextExpiry: string;
    if (typeof new_expiry_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(new_expiry_date)) {
      nextExpiry = new_expiry_date;
    } else if (typeof extend_days === 'number' && extend_days > 0) {
      const current = ut.expiry_date ? new Date(ut.expiry_date) : new Date();
      const next = new Date(current);
      next.setDate(next.getDate() + extend_days);
      nextExpiry = next.toISOString().slice(0, 10);
    } else {
      return NextResponse.json(
        { error: 'extend_days(양수) 또는 new_expiry_date(YYYY-MM-DD)를 입력해주세요.' },
        { status: 400 }
      );
    }

    const { error: updateErr } = await supabase
      .from('user_tickets')
      .update({ expiry_date: nextExpiry })
      .eq('id', userTicketId);
    if (updateErr) throw updateErr;

    return NextResponse.json({
      data: { user_ticket_id: userTicketId, expiry_date: nextExpiry },
      message: '유효기간이 연장되었습니다.',
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
