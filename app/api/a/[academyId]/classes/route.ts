/**
 * POST /api/a/[academyId]/classes  — 라이트 어드민 "수업 추가"
 *
 * 최소 입력으로 **바로 예약 가능한** 수업 1개 + 회차를 만든다.
 * - 수업군(class_group_id) 은 필수 — 미지정 수업은 예약 불가라서, 새 수업이 곧바로 예약되게 하려면 반드시 지정한다.
 * - 반복은 "매주 N주" = 단회 회차 N개 생성으로 표현한다 (반복 규칙 엔진 대신 단순·정직).
 *   각 회차는 독립 회차이므로 개별 수정/휴강이 자연스럽다.
 *
 * 비즈니스 로직을 새로 만들지 않는다 — classes/schedules 에 기존과 동일한 형태로 삽입만 한다.
 * (신규 회차 백필·예약 준비 판정은 기존 트리거/엔진이 그대로 담당한다.)
 */
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { kstDateTimeToUtc, addDays } from '@/lib/date/kst';
import { withStaff, badRequest, belongsToAcademy } from '../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_REPEAT = 12;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const classGroupId = typeof body.classGroupId === 'string' ? body.classGroupId : '';
    const date = typeof body.date === 'string' ? body.date : '';
    const startTime = typeof body.startTime === 'string' ? body.startTime : '';
    const endTime = typeof body.endTime === 'string' ? body.endTime : '';
    const instructorName =
      typeof body.instructorName === 'string' && body.instructorName.trim()
        ? body.instructorName.trim()
        : null;
    const hallId = typeof body.hallId === 'string' && body.hallId ? body.hallId : null;
    const audienceMembershipId =
      typeof body.audienceMembershipId === 'string' && body.audienceMembershipId
        ? body.audienceMembershipId
        : null;
    const capacity =
      typeof body.capacity === 'number' && body.capacity > 0 ? Math.floor(body.capacity) : 20;
    const repeatWeeks =
      typeof body.repeatWeeks === 'number' && body.repeatWeeks >= 1
        ? Math.min(Math.floor(body.repeatWeeks), MAX_REPEAT)
        : 1;

    if (!title) return badRequest('수업 제목을 입력해 주세요.');
    if (!classGroupId) return badRequest('수업군을 선택해 주세요. (예약을 열려면 필수예요)');
    if (!DATE_RE.test(date)) return badRequest('날짜 형식이 올바르지 않아요.');
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) return badRequest('시간 형식이 올바르지 않아요.');
    if (endTime <= startTime) return badRequest('종료 시간이 시작 시간보다 늦어야 해요.');

    // 참조 무결성 — 전부 이 학원 소유여야 한다
    if (!(await belongsToAcademy(supabase, 'class_groups', classGroupId, academyId))) {
      return badRequest('수업군을 찾을 수 없어요.');
    }
    if (hallId && !(await belongsToAcademy(supabase, 'halls', hallId, academyId))) {
      return badRequest('홀을 찾을 수 없어요.');
    }
    if (audienceMembershipId && !(await belongsToAcademy(supabase, 'memberships', audienceMembershipId, academyId))) {
      return badRequest('전문반(멤버십)을 찾을 수 없어요.');
    }

    // 1) 수업 마스터
    const { data: cls, error: clsErr } = await supabase
      .from('classes')
      .insert({
        academy_id: academyId,
        title,
        class_type: 'regular',
        status: '정상',
        is_active: true,
        max_students: capacity,
        instructor_name: instructorName,
        hall_id: hallId,
        class_group_id: classGroupId,
        audience_membership_id: audienceMembershipId,
      })
      .select('id')
      .single();
    if (clsErr || !cls) {
      console.error('[api/a/classes] class insert 실패:', clsErr);
      return NextResponse.json({ error: '수업 생성에 실패했어요.', detail: clsErr?.message }, { status: 500 });
    }

    // 2) 회차 — 매주 N주 = 단회 회차 N개
    const scheduleRows = [];
    for (let i = 0; i < repeatWeeks; i++) {
      const d = addDays(date, i * 7);
      scheduleRows.push({
        class_id: cls.id,
        start_time: kstDateTimeToUtc(d, startTime).toISOString(),
        end_time: kstDateTimeToUtc(d, endTime).toISOString(),
        max_students: capacity,
        hall_id: hallId,
        instructor_name_text: instructorName,
        is_canceled: false,
      });
    }
    const { data: scheds, error: schErr } = await supabase
      .from('schedules')
      .insert(scheduleRows)
      .select('id');
    if (schErr) {
      console.error('[api/a/classes] schedule insert 실패:', schErr);
      return NextResponse.json({ error: '회차 생성에 실패했어요.', detail: schErr.message }, { status: 500 });
    }

    return {
      classId: cls.id,
      scheduleIds: (scheds ?? []).map((s: any) => s.id),
      count: (scheds ?? []).length,
    };
  });
}
