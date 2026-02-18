/**
 * PATCH /api/academy-admin/[academyId]/schedule-change-requests/[requestId]
 * 승인(APPROVED) 또는 거절(REJECTED). Body: status, admin_note(선택).
 * 승인 시 SUBSTITUTE -> 스케줄 instructor_id 변경, CANCEL -> is_canceled=true.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { updateSchedule } from '@/lib/db/schedules';

async function assertAcademyAdmin(academyId: string, userId: string) {
  const supabase = createServiceClient();
  const { data: userData } = await (supabase as any)
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  const isSuperAdmin = userData?.role === 'SUPER_ADMIN';
  if (isSuperAdmin) return;
  const { data: roleData, error: roleError } = await (supabase as any)
    .from('academy_user_roles')
    .select('role')
    .eq('academy_id', academyId)
    .eq('user_id', userId)
    .single();
  if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
    throw new Error('학원 관리자 권한이 필요합니다.');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string; requestId: string }> }
) {
  try {
    const { academyId, requestId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    await assertAcademyAdmin(academyId, user.id);

    const body = await request.json().catch(() => ({}));
    const { status, admin_note } = body;
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'status는 APPROVED 또는 REJECTED 여야 합니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient() as any;
    const { data: row, error: fetchError } = await supabase
      .from('schedule_change_requests')
      .select('*')
      .eq('id', requestId)
      .eq('academy_id', academyId)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: '해당 신청을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (row.status !== 'PENDING') {
      return NextResponse.json({ error: '이미 처리된 신청입니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status,
      processed_by: user.id,
      processed_at: now,
      admin_note: admin_note != null ? String(admin_note).trim() || null : null,
      updated_at: now,
    };

    if (status === 'APPROVED') {
      if (row.request_type === 'SUBSTITUTE' && row.requested_instructor_id) {
        await updateSchedule(row.schedule_id, { instructor_id: row.requested_instructor_id });
      } else if (row.request_type === 'CANCEL') {
        await updateSchedule(row.schedule_id, { is_canceled: true });
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('schedule_change_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .eq('academy_id', academyId)
      .select()
      .single();

    if (updateError) {
      console.error('[PATCH schedule-change-requests]', updateError);
      return NextResponse.json({ error: '처리 저장에 실패했습니다.' }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('[PATCH schedule-change-requests]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
