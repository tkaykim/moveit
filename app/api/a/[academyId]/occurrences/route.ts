/**
 * GET /api/a/[academyId]/occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * 라이트 어드민 "수업" 주간 그리드용 회차 목록.
 * 기간(KST) 내 모든 회차를 **휴강 포함** 정직하게 준다 (휴강은 UI 에서 취소선).
 * 조회 전용 — 고정 개수 쿼리 (N+1 금지). 도메인 판정 없음.
 */
import { NextRequest } from 'next/server';
import { kstDayRangeUtc } from '@/lib/db/operator-console';
import { addDays, kstToday } from '@/lib/date/kst';
import { withStaff } from '../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function uniq<T>(xs: (T | null | undefined)[]): T[] {
  return Array.from(new Set(xs.filter((x): x is T => x != null && x !== '')));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  const sp = new URL(request.url).searchParams;
  const fromRaw = sp.get('from');
  const toRaw = sp.get('to');
  const from = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : kstToday();
  const to = toRaw && DATE_RE.test(toRaw) ? toRaw : addDays(from, 6);

  return withStaff(request, academyId, async ({ supabase }) => {
    const { startUtc } = kstDayRangeUtc(from);
    const { endUtc } = kstDayRangeUtc(to); // [from 00:00 KST, to+1 00:00 KST)

    // (1) 이 학원의 수업 (수업군·대상 정보 포함)
    const { data: classes } = await supabase
      .from('classes')
      .select('id, title, instructor_name, class_group_id, audience_membership_id')
      .eq('academy_id', academyId)
      .or('is_active.is.null,is_active.eq.true');
    const classIds = uniq((classes ?? []).map((c: any) => c.id as string));
    if (classIds.length === 0) return { from, to, occurrences: [] };
    const classMap = new Map((classes ?? []).map((c: any) => [c.id, c]));

    // (2) 기간 내 회차 (휴강 포함)
    const { data: schedules } = await supabase
      .from('schedules')
      .select('id, class_id, start_time, end_time, max_students, is_canceled, hall_id, instructor_name_text')
      .in('class_id', classIds)
      .gte('start_time', startUtc)
      .lt('start_time', endUtc)
      .order('start_time', { ascending: true });
    const rows = schedules ?? [];
    const scheduleIds = uniq(rows.map((s: any) => s.id as string));
    if (scheduleIds.length === 0) return { from, to, occurrences: [] };

    // (3) 부가정보 — 전부 한 번씩만
    const groupIds = uniq((classes ?? []).map((c: any) => c.class_group_id));
    const hallIds = uniq(rows.map((s: any) => s.hall_id));
    const [groupsRes, hallsRes, bookingsRes] = await Promise.all([
      groupIds.length
        ? supabase.from('class_groups').select('id, name, is_special').in('id', groupIds)
        : Promise.resolve({ data: [] }),
      hallIds.length
        ? supabase.from('halls').select('id, name').in('id', hallIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('bookings')
        .select('schedule_id, status')
        .in('schedule_id', scheduleIds),
    ]);
    const groupMap = new Map((groupsRes.data ?? []).map((g: any) => [g.id, g]));
    const hallMap = new Map((hallsRes.data ?? []).map((h: any) => [h.id, h]));

    // 회차별 신청 수 (취소 제외)
    const bookedCount = new Map<string, number>();
    for (const b of (bookingsRes.data ?? []) as any[]) {
      if ((b.status ?? '').toUpperCase() === 'CANCELLED') continue;
      bookedCount.set(b.schedule_id, (bookedCount.get(b.schedule_id) ?? 0) + 1);
    }

    const occurrences = rows.map((s: any) => {
      const c = classMap.get(s.class_id) as any;
      const g = c?.class_group_id ? (groupMap.get(c.class_group_id) as any) : null;
      const h = s.hall_id ? (hallMap.get(s.hall_id) as any) : null;
      return {
        schedule_id: s.id,
        class_id: s.class_id,
        class_title: c?.title ?? '수업',
        instructor_name: s.instructor_name_text ?? c?.instructor_name ?? null,
        start_time: s.start_time,
        end_time: s.end_time,
        is_canceled: !!s.is_canceled,
        max_students: s.max_students,
        booked_count: bookedCount.get(s.id) ?? 0,
        hall_id: s.hall_id ?? null,
        hall_name: h?.name ?? null,
        class_group_id: c?.class_group_id ?? null,
        class_group_name: g?.name ?? null,
        is_special: g?.is_special ?? false,
        audience_membership_id: c?.audience_membership_id ?? null,
        needs_readiness: !c?.class_group_id, // 수업군 미지정 = 예약 준비 필요
      };
    });

    return { from, to, occurrences };
  });
}
