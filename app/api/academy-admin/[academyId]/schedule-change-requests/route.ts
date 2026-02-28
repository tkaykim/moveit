/**
 * GET /api/academy-admin/[academyId]/schedule-change-requests?status=PENDING|APPROVED|REJECTED
 * 해당 학원의 대강/취소 신청 목록. 학원 관리자 또는 SUPER_ADMIN만.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';

export async function GET(
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

    const status = request.nextUrl.searchParams.get('status') || undefined;

    const supabase = createServiceClient() as any;
    let query = supabase
      .from('schedule_change_requests')
      .select(
        `
        *,
        schedules (
          id,
          start_time,
          end_time,
          is_canceled,
          instructor_id,
          classes (
            id,
            title,
            academies ( id, name_kr )
          ),
          instructors ( id, name_kr, name_en )
        ),
        requested_by:instructors!schedule_change_requests_requested_by_instructor_id_fkey ( id, name_kr, name_en ),
        requested_instructor:instructors!schedule_change_requests_requested_instructor_id_fkey ( id, name_kr, name_en )
      `
      )
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false });

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[GET schedule-change-requests]', error);
      return NextResponse.json({ error: '목록 조회에 실패했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    if (e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('[GET schedule-change-requests]', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
