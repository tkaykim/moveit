/**
 * POST /api/academy-admin/[academyId]/adjust-ticket-count
 * 관리자가 횟수권의 잔여 횟수를 조정 (차감/충전)
 * - user_tickets.remaining_count 업데이트
 * - enrollment_activity_log에 COUNT_DEDUCT 또는 COUNT_RESTORE 기록
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { insertEnrollmentActivityLog } from '@/lib/db/enrollment-activity-log';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    await assertAcademyAdmin(academyId, user.id);

    const body = await request.json();
    const { user_ticket_id, delta, reason } = body;

    if (!user_ticket_id || typeof user_ticket_id !== 'string') {
      return NextResponse.json({ error: 'user_ticket_id가 필요합니다.' }, { status: 400 });
    }
    if (typeof delta !== 'number' || delta === 0 || !Number.isInteger(delta)) {
      return NextResponse.json({ error: '변경할 횟수(delta)는 0이 아닌 정수여야 합니다.' }, { status: 400 });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: '사유(reason)를 입력해주세요.' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;

    const { data: userTicket, error: fetchError } = await supabase
      .from('user_tickets')
      .select(`
        id,
        user_id,
        remaining_count,
        status,
        ticket_id,
        tickets (
          id,
          name,
          ticket_type,
          academy_id
        )
      `)
      .eq('id', user_ticket_id)
      .single();

    if (fetchError || !userTicket) {
      return NextResponse.json({ error: '수강권을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (userTicket.tickets?.ticket_type === 'PERIOD') {
      return NextResponse.json({ error: '기간제 수강권은 횟수 조정이 불가합니다.' }, { status: 400 });
    }

    if (userTicket.tickets?.academy_id !== academyId) {
      return NextResponse.json({ error: '해당 학원의 수강권이 아닙니다.' }, { status: 403 });
    }

    const currentCount = userTicket.remaining_count ?? 0;
    const newCount = currentCount + delta;

    if (newCount < 0) {
      return NextResponse.json(
        { error: `잔여 횟수(${currentCount}회)보다 많이 차감할 수 없습니다.` },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { remaining_count: newCount };

    if (newCount === 0 && userTicket.status === 'ACTIVE') {
      updates.status = 'USED';
    } else if (newCount > 0 && userTicket.status === 'USED') {
      updates.status = 'ACTIVE';
    }

    const { data: updated, error: updateError } = await supabase
      .from('user_tickets')
      .update(updates)
      .eq('id', user_ticket_id)
      .select()
      .single();

    if (updateError) {
      console.error('[adjust-ticket-count] update error:', updateError);
      return NextResponse.json({ error: '수강권 횟수 업데이트에 실패했습니다.' }, { status: 500 });
    }

    const action = delta > 0 ? 'COUNT_RESTORE' : 'COUNT_DEDUCT';
    await insertEnrollmentActivityLog(
      {
        academy_id: academyId,
        user_id: userTicket.user_id,
        user_ticket_id: user_ticket_id,
        action,
        payload: {
          ticket_name: userTicket.tickets?.name,
          delta,
          previous_count: currentCount,
          remaining_count: newCount,
          reason: reason.trim(),
          via: 'admin_manual',
        },
        note: reason.trim(),
        actor_user_id: user.id,
      },
      supabase
    );

    return NextResponse.json({
      success: true,
      remaining_count: newCount,
      status: updated.status,
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && (e as Error).message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('adjust-ticket-count POST error:', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
