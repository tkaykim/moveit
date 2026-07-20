/**
 * GET /api/academy-admin/[academyId]/console/makeup-candidates   (T9)
 *
 * 보강 화면의 선택지 — "옮길 예약"과 "옮겨 갈 회차".
 *
 * ⚠ 여기서 보강 가능 여부를 판정하지 않는다. 월 1회 한도·정원·같은 고정수업 여부는
 *   전부 T6 의 DB 함수 create_makeup_booking 이 단일 정본으로 강제한다.
 *   이 라우트는 후보를 보여줄 뿐이고, 최종 거절은 서버가 한다.
 */
import { NextRequest } from 'next/server';
import { withConsoleStaff } from '../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;

  return withConsoleStaff(request, academyId, async ({ supabase }) => {
    const { data: classes } = await supabase
      .from('classes')
      .select('id, title')
      .eq('academy_id', academyId);
    const classIds = (classes ?? []).map((c: any) => c.id);
    if (classIds.length === 0) return { bookings: [], schedules: [] };
    const classMap = new Map<string, any>((classes ?? []).map((c: any) => [c.id, c]));

    const nowIso = new Date().toISOString();
    const horizon = new Date(Date.now() + 60 * 86400_000).toISOString();

    const [bookingsRes, schedulesRes] = await Promise.all([
      // 최근 예약 — 결석·취소·예정 모두. 어떤 걸 옮길지는 직원이 안다.
      supabase
        .from('bookings')
        .select('id, user_id, class_id, schedule_id, status, created_at')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })
        .limit(100),
      // 앞으로 열리는 회차
      supabase
        .from('schedules')
        .select('id, class_id, start_time, max_students, is_canceled')
        .in('class_id', classIds)
        .gte('start_time', nowIso)
        .lte('start_time', horizon)
        .eq('is_canceled', false)
        .order('start_time', { ascending: true })
        .limit(200),
    ]);

    const bookings = bookingsRes.data ?? [];
    const userIds = Array.from(new Set(bookings.map((b: any) => b.user_id).filter(Boolean)));
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, name, nickname').in('id', userIds)
      : { data: [] as any[] };
    const userMap = new Map<string, any>((users ?? []).map((u: any) => [u.id, u]));

    // 회차 시각 (예약 표시용) — 한 번에
    const schedIds = Array.from(new Set(bookings.map((b: any) => b.schedule_id).filter(Boolean)));
    const { data: bookedScheds } = schedIds.length
      ? await supabase.from('schedules').select('id, start_time').in('id', schedIds)
      : { data: [] as any[] };
    const schedMap = new Map<string, any>((bookedScheds ?? []).map((s: any) => [s.id, s]));

    return {
      bookings: bookings.map((b: any) => ({
        id: b.id,
        class_id: b.class_id,
        class_title: classMap.get(b.class_id)?.title ?? '수업',
        student_name: userMap.get(b.user_id)?.name || userMap.get(b.user_id)?.nickname || '이름 없음',
        status: b.status,
        start_time: schedMap.get(b.schedule_id)?.start_time ?? null,
      })),
      schedules: (schedulesRes.data ?? []).map((s: any) => ({
        id: s.id,
        class_id: s.class_id,
        class_title: classMap.get(s.class_id)?.title ?? '수업',
        start_time: s.start_time,
      })),
    };
  });
}
