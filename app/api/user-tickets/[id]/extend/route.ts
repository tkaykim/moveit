import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { insertEnrollmentActivityLog } from '@/lib/db/enrollment-activity-log';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';

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
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const body = await request.json();
    const { extend_days, new_expiry_date } = body;

    const { data: ut, error: fetchErr } = await supabase
      .from('user_tickets')
      .select('id, user_id, expiry_date, ticket_id, tickets(academy_id)')
      .eq('id', userTicketId)
      .single();
    if (fetchErr || !ut) {
      return NextResponse.json({ error: '수강권을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 인가: 대상 수강권이 속한 학원의 관리자만 임의 연장 가능
    const ticketAcademyId = ut.tickets?.academy_id;
    if (!ticketAcademyId) {
      return NextResponse.json({ error: '수강권의 학원 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    try {
      await assertAcademyAdmin(ticketAcademyId, authUser.id);
    } catch {
      return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
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

    // 활동 로그: 관리자 임의 연장
    const academyId = ticketAcademyId;
    if (academyId) {
      insertEnrollmentActivityLog({
        academy_id: academyId,
        user_id: ut.user_id ?? null,
        user_ticket_id: userTicketId,
        action: 'ADMIN_EXTEND',
        payload: {
          prev_expiry: ut.expiry_date,
          new_expiry: nextExpiry,
          extend_days: extend_days ?? null,
        },
        actor_user_id: authUser?.id ?? null,
      }, supabase).catch(() => {});
    }

    return NextResponse.json({
      data: { user_ticket_id: userTicketId, expiry_date: nextExpiry },
      message: '유효기간이 연장되었습니다.',
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
