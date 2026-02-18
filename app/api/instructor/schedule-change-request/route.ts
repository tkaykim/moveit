/**
 * POST /api/instructor/schedule-change-request
 * 강사 대강신청(SUBSTITUTE) 또는 취소신청(CANCEL).
 * Body: schedule_id, request_type, reason (필수). 대강 시 requested_instructor_id 또는 requested_instructor_name (선택).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/supabase/server-auth';
import { getInstructorByUserId } from '@/lib/db/instructors';
import { getScheduleById } from '@/lib/db/schedules';
import {
  hasPendingRequest,
  createScheduleChangeRequest,
  type ScheduleChangeRequestType,
} from '@/lib/db/schedule-change-requests';

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json().catch(() => ({}));
    const {
      schedule_id,
      request_type,
      reason,
      requested_instructor_id,
      requested_instructor_name,
    } = body;

    if (!schedule_id || !request_type) {
      return NextResponse.json(
        { error: 'schedule_id, request_type가 필요합니다.' },
        { status: 400 }
      );
    }
    if (!['SUBSTITUTE', 'CANCEL'].includes(request_type)) {
      return NextResponse.json(
        { error: 'request_type는 SUBSTITUTE 또는 CANCEL 이어야 합니다.' },
        { status: 400 }
      );
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: '사유를 입력해주세요.' }, { status: 400 });
    }

    const schedule = await getScheduleById(schedule_id);
    if (!schedule) {
      return NextResponse.json({ error: '해당 수업을 찾을 수 없습니다.' }, { status: 404 });
    }

    if ((schedule as any).instructor_id !== instructor.id) {
      return NextResponse.json(
        { error: '해당 수업의 담당 강사만 신청할 수 있습니다.' },
        { status: 403 }
      );
    }

    const classRow = (schedule as any).classes;
    const academyId = classRow?.academy_id;
    if (!academyId) {
      return NextResponse.json({ error: '수업의 학원 정보를 찾을 수 없습니다.' }, { status: 400 });
    }

    const supabase = await getAuthenticatedSupabase(request) as any;
    const { data: link } = await supabase
      .from('academy_instructors')
      .select('id')
      .eq('academy_id', academyId)
      .eq('instructor_id', instructor.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!link) {
      return NextResponse.json(
        { error: '해당 학원 소속 강사만 신청할 수 있습니다.' },
        { status: 403 }
      );
    }

    const pending = await hasPendingRequest(schedule_id, request_type as ScheduleChangeRequestType);
    if (pending) {
      return NextResponse.json(
        { error: '이미 동일한 유형의 신청이 대기 중입니다.' },
        { status: 400 }
      );
    }

    const insertRow = {
      schedule_id,
      academy_id: academyId,
      request_type: request_type as ScheduleChangeRequestType,
      requested_by_instructor_id: instructor.id,
      reason: reason.trim(),
      requested_instructor_id: request_type === 'SUBSTITUTE' ? (requested_instructor_id ?? null) : null,
      requested_instructor_name: request_type === 'SUBSTITUTE' ? (requested_instructor_name?.trim() ?? null) : null,
    };

    const inserted = await createScheduleChangeRequest(insertRow);
    return NextResponse.json(inserted);
  } catch (e) {
    console.error('[POST /api/instructor/schedule-change-request]', e);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
