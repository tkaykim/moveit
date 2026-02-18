/**
 * GET /api/instructor/schedule/[scheduleId]
 * 해당 수업 상세 + 수강인원 요약. 본인 강사 배정 수업만 조회 가능.
 * 쿠키 또는 Authorization Bearer 토큰 지원.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { getInstructorByUserId } from '@/lib/db/instructors';
import { getScheduleEnrollmentSummary } from '@/lib/db/bookings';

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

    const summary = await getScheduleEnrollmentSummary(scheduleId);
    if (!summary) {
      return NextResponse.json(
        { error: '수업을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const schedule = summary.schedule as any;
    if (schedule.instructor_id !== instructor.id) {
      return NextResponse.json(
        { error: '해당 수업에 대한 접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        is_canceled: schedule.is_canceled,
        max_students: schedule.max_students,
        classes: schedule.classes,
        academies: schedule.classes?.academies,
        halls: schedule.halls,
      },
      enrollment: {
        confirmed: summary.confirmed_count,
        pending: summary.pending_count,
        cancelled: summary.cancelled_count,
        completed: summary.completed_count,
        total: summary.total_enrollments,
        max_students: summary.max_students,
        remaining_spots: summary.remaining_spots,
      },
    });
  } catch (e) {
    console.error('[GET /api/instructor/schedule/[scheduleId]]', e);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
