/**
 * GET /api/instructor/schedule/[scheduleId]/substitute-candidates?q=
 * 해당 수업의 학원(classes → academy_id) 소속 강사 목록 검색. 본인 제외. 대강 신청 시 후보 선택용.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';
import { getInstructorByUserId } from '@/lib/db/instructors';
import { getScheduleById } from '@/lib/db/schedules';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  try {
    const { scheduleId } = await params;
    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId가 필요합니다.' }, { status: 400 });
    }

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const instructor = await getInstructorByUserId(user.id);
    if (!instructor?.id) {
      return NextResponse.json(
        { error: '연결된 강사 프로필이 없습니다.' },
        { status: 404 }
      );
    }

    const schedule = await getScheduleById(scheduleId);
    if (!schedule) {
      return NextResponse.json({ error: '수업을 찾을 수 없습니다.' }, { status: 404 });
    }

    if ((schedule as any).instructor_id !== instructor.id) {
      return NextResponse.json(
        { error: '해당 수업에 대한 접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const classRow = (schedule as any).classes;
    const academyId = classRow?.academy_id;
    if (!academyId) {
      return NextResponse.json({ error: '수업의 학원 정보를 찾을 수 없습니다.' }, { status: 400 });
    }

    const supabase = await getAuthenticatedSupabase(request) as any;
    const { data: rows, error } = await supabase
      .from('academy_instructors')
      .select(
        `
        instructor_id,
        instructors (
          id,
          name_kr,
          name_en
        )
      `
      )
      .eq('academy_id', academyId)
      .eq('is_active', true)
      .neq('instructor_id', instructor.id)
      .limit(50);

    if (error) {
      console.error('[substitute-candidates]', error);
      return NextResponse.json({ error: '강사 목록 조회에 실패했습니다.' }, { status: 500 });
    }

    const instructors = (rows || [])
      .map((r: any) => r.instructors)
      .filter((i: any) => i != null);

    const q = request.nextUrl.searchParams.get('q')?.trim() || '';
    const term = q.length >= 1 ? q.toLowerCase() : '';
    const filtered = term
      ? instructors.filter(
          (i: any) =>
            (i.name_kr && i.name_kr.toLowerCase().includes(term)) ||
            (i.name_en && i.name_en.toLowerCase().includes(term))
        )
      : instructors;

    return NextResponse.json({ instructors: filtered });
  } catch (e) {
    console.error('[GET /api/instructor/schedule/.../substitute-candidates]', e);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
