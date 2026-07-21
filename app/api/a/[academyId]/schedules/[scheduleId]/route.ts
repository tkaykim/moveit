/**
 * PATCH /api/a/[academyId]/schedules/[scheduleId]  — 라이트 어드민 "수업 수정 / 휴강"
 *
 * 두 가지를 처리한다:
 *  1) 수정: 시간(date+start+end)·정원·홀·강사·수업군 변경 (회차 + 필요한 경우 수업 마스터)
 *  2) 휴강: { isCanceled: true } → schedules.is_canceled=true (소프트).
 *     휴강 전파(횟수 복구·기간 연장·알림)는 기존 CLASS_CANCELED 이벤트 파이프라인이 자동 처리한다.
 *
 * 하드 삭제 없음. 비즈니스 로직을 새로 만들지 않는다.
 */
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { kstDateTimeToUtc } from '@/lib/date/kst';
import { withStaff, badRequest, belongsToAcademy } from '../../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string; scheduleId: string }> }
) {
  const { academyId, scheduleId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    // 이 회차가 이 학원 소유인지 확인 (교차 학원 차단)
    const { data: sched } = await supabase
      .from('schedules')
      .select('id, class_id, classes(academy_id)')
      .eq('id', scheduleId)
      .maybeSingle();
    if (!sched || (sched as any).classes?.academy_id !== academyId) {
      return NextResponse.json({ error: '회차를 찾을 수 없어요.' }, { status: 404 });
    }
    const classId = (sched as any).class_id as string;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // ── 휴강 (소프트) ──
    if (body.isCanceled === true) {
      const { error } = await supabase
        .from('schedules')
        .update({ is_canceled: true })
        .eq('id', scheduleId);
      if (error) {
        return NextResponse.json({ error: '휴강 처리에 실패했어요.', detail: error.message }, { status: 500 });
      }
      // is_canceled false→true 트리거가 booking_events(CLASS_CANCELED) 를 기록하고,
      // 멱등 처리기가 환불/연장/알림을 자동 수행한다.
      return { ok: true, canceled: true };
    }

    // ── 수정 ──
    const schedulePatch: Record<string, unknown> = {};
    const classPatch: Record<string, unknown> = {};

    const date = typeof body.date === 'string' ? body.date : '';
    const startTime = typeof body.startTime === 'string' ? body.startTime : '';
    const endTime = typeof body.endTime === 'string' ? body.endTime : '';
    if (date || startTime || endTime) {
      if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
        return badRequest('날짜·시간을 모두 올바르게 입력해 주세요.');
      }
      if (endTime <= startTime) return badRequest('종료 시간이 시작 시간보다 늦어야 해요.');
      schedulePatch.start_time = kstDateTimeToUtc(date, startTime).toISOString();
      schedulePatch.end_time = kstDateTimeToUtc(date, endTime).toISOString();
    }

    if (typeof body.capacity === 'number' && body.capacity > 0) {
      schedulePatch.max_students = Math.floor(body.capacity);
      classPatch.max_students = Math.floor(body.capacity);
    }

    if ('hallId' in body) {
      const hallId = typeof body.hallId === 'string' && body.hallId ? body.hallId : null;
      if (hallId && !(await belongsToAcademy(supabase, 'halls', hallId, academyId))) {
        return badRequest('홀을 찾을 수 없어요.');
      }
      schedulePatch.hall_id = hallId;
    }

    if ('instructorName' in body) {
      const name =
        typeof body.instructorName === 'string' && body.instructorName.trim()
          ? body.instructorName.trim()
          : null;
      schedulePatch.instructor_name_text = name;
      classPatch.instructor_name = name;
    }

    if (typeof body.classGroupId === 'string' && body.classGroupId) {
      if (!(await belongsToAcademy(supabase, 'class_groups', body.classGroupId, academyId))) {
        return badRequest('수업군을 찾을 수 없어요.');
      }
      classPatch.class_group_id = body.classGroupId;
    }

    if (Object.keys(schedulePatch).length === 0 && Object.keys(classPatch).length === 0) {
      return badRequest('변경할 내용이 없어요.');
    }

    if (Object.keys(schedulePatch).length > 0) {
      const { error } = await supabase.from('schedules').update(schedulePatch).eq('id', scheduleId);
      if (error) {
        return NextResponse.json({ error: '회차 수정에 실패했어요.', detail: error.message }, { status: 500 });
      }
    }
    if (Object.keys(classPatch).length > 0) {
      const { error } = await supabase.from('classes').update(classPatch).eq('id', classId);
      if (error) {
        return NextResponse.json({ error: '수업 수정에 실패했어요.', detail: error.message }, { status: 500 });
      }
    }

    return { ok: true };
  });
}
