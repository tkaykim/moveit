/**
 * GET /api/s/[slug]/me   (T10)
 *
 * 미니앱 MY 의 단일 데이터 경로 — 이 학원 범위의 **내** 수강권·멤버십·예약.
 *
 * 화이트라벨 원칙: 다른 학원 데이터는 한 줄도 넘기지 않는다.
 * 멤버십 노출 원칙: **본인이 가진 멤버십만** 돌려준다.
 *   memberships 테이블은 스태프 전용(RLS)이라 학생이 직접 읽을 수 없고,
 *   여기서도 학생 자신의 student_memberships 에 걸린 것만 이름을 붙여 준다
 *   (비공개 멤버십 목록이 새어나가면 안 된다).
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { getAcademyBySlug } from '@/lib/db/miniapp';
import { kstToday } from '@/lib/date/kst';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const academy = await getAcademyBySlug(slug);
    if (!academy) {
      return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404, headers: NO_CACHE });
    }

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.', tickets: [], memberships: [], bookings: [] },
        { status: 401, headers: NO_CACHE }
      );
    }

    const supabase = createServiceClient() as any;
    const today = kstToday();

    // ① 이 학원의 내 수강권 (start_mode 포함 — "아직 시작 안 함" 판정에 필요)
    const { data: ticketRows } = await supabase
      .from('user_tickets')
      .select(
        'id, status, remaining_count, start_date, expiry_date, fixed_class_id, ' +
          'tickets!inner(id, name, ticket_type, total_count, start_mode, valid_days, academy_id)'
      )
      .eq('user_id', user.id)
      .eq('tickets.academy_id', academy.id)
      .order('created_at', { ascending: false });

    const tickets = ((ticketRows ?? []) as any[]).map((t) => {
      const startMode = t.tickets?.start_mode ?? 'IMMEDIATE';
      // FIRST_BOOKING 수강권은 첫 예약 전까지 기간이 흐르지 않는다.
      const notStarted = startMode === 'FIRST_BOOKING' && !t.start_date;
      return {
        id: t.id,
        status: t.status,
        remaining_count: t.remaining_count,
        start_date: t.start_date,
        expiry_date: t.expiry_date,
        name: t.tickets?.name ?? '수강권',
        ticket_type: t.tickets?.ticket_type ?? null,
        total_count: t.tickets?.total_count ?? null,
        valid_days: t.tickets?.valid_days ?? null,
        start_mode: startMode,
        not_started: notStarted,
      };
    });

    // ② 내 멤버십 (본인 것만)
    const { data: smRows } = await supabase
      .from('student_memberships')
      .select('id, status, start_date, end_date, membership_id, memberships(id, name, perks_text)')
      .eq('user_id', user.id)
      .eq('academy_id', academy.id)
      .eq('status', 'ACTIVE');

    const memberships = ((smRows ?? []) as any[])
      .filter(
        (m) =>
          (!m.start_date || m.start_date <= today) && (!m.end_date || m.end_date >= today)
      )
      .map((m) => ({
        id: m.id,
        name: m.memberships?.name ?? '멤버십',
        perks: (m.memberships?.perks_text ?? []) as string[],
        start_date: m.start_date,
        end_date: m.end_date,
      }));

    // ③ 다가오는 예약 (출석 QR 용)
    const { data: bookingRows } = await supabase
      .from('bookings')
      .select(
        'id, status, schedule_id, schedules!inner(id, start_time, end_time, classes!inner(id, title, academy_id))'
      )
      .eq('user_id', user.id)
      .eq('schedules.classes.academy_id', academy.id)
      .gte('schedules.start_time', new Date().toISOString())
      .neq('status', 'CANCELED')
      .order('start_time', { ascending: true, referencedTable: 'schedules' });

    const bookings = ((bookingRows ?? []) as any[]).map((b) => ({
      id: b.id,
      status: b.status,
      start_time: b.schedules?.start_time ?? null,
      title: b.schedules?.classes?.title ?? '수업',
    }));

    return NextResponse.json({ tickets, memberships, bookings }, { headers: NO_CACHE });
  } catch (e: unknown) {
    console.error('[s/me]', (e as Error)?.message);
    return NextResponse.json(
      { error: '내 정보를 불러오지 못했습니다.' },
      { status: 500, headers: NO_CACHE }
    );
  }
}
