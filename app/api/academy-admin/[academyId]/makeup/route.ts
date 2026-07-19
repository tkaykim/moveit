/**
 * POST /api/academy-admin/[academyId]/makeup
 * Body: { bookingId, targetScheduleId }
 *
 * 보강(補講) — 결석/휴강 회차를 같은 고정수업의 다른 날짜로 옮긴다. 직원 전용.
 *
 * ⚠ 규칙 판정을 여기서 다시 하지 않는다.
 *   월 1회 한도 · 3개월 상품 거절 · 정원 · 중복 · 같은 고정수업 여부는 전부
 *   T6 의 DB 함수 create_makeup_booking 이 단일 소스로 강제한다.
 *   (조건이 두 곳에 있으면 반드시 갈라진다 — T6 규율 계승)
 *
 * 이 라우트가 하는 일: 직원 인증 → RPC 호출 → 에러코드 사용자 문구 매핑 → 감사 기록.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { createMakeupBooking, parseMakeupError } from '@/lib/booking/fixed-weekly';
import { logTicketEvent } from '@/lib/db/enrollment-activity-log';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    await assertAcademyAdmin(academyId, user.id);

    const body = await request.json().catch(() => ({}));
    const { bookingId, targetScheduleId } = body as {
      bookingId?: string;
      targetScheduleId?: string;
    };

    if (!bookingId || !targetScheduleId) {
      return NextResponse.json(
        { error: 'bookingId 와 targetScheduleId 가 모두 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient() as never;

    // 학원 경계 확인 — 다른 학원의 예약/회차를 이 학원 직원이 옮길 수 없다.
    const svc = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> };
        };
      };
    };

    const { data: bk } = await svc
      .from('bookings')
      .select('id, class_id, user_id, user_ticket_id')
      .eq('id', bookingId)
      .maybeSingle();
    if (!bk) {
      return NextResponse.json({ error: '예약을 찾을 수 없습니다.' }, { status: 404 });
    }
    const { data: cls } = await svc
      .from('classes')
      .select('academy_id')
      .eq('id', String(bk.class_id))
      .maybeSingle();
    if (!cls || cls.academy_id !== academyId) {
      return NextResponse.json({ error: '이 학원의 예약이 아닙니다.' }, { status: 403 });
    }

    let result;
    try {
      result = await createMakeupBooking(supabase, {
        bookingId,
        targetScheduleId,
        actorId: user.id,
      });
    } catch (e) {
      const mapped = parseMakeupError(e);
      return NextResponse.json(
        { error: mapped.message, code: mapped.code, detail: mapped.detail },
        { status: mapped.status }
      );
    }

    await logTicketEvent(
      {
        academy_id: academyId,
        user_id: (bk.user_id as string) ?? null,
        user_ticket_id: (bk.user_ticket_id as string) ?? null,
        booking_id: result.booking_id,
        action: 'MAKEUP',
        via: 'manual',
        reason: 'makeup',
        context: {
          makeup_grant_id: result.makeup_grant_id,
          month_key: result.month_key,
          from_booking_id: result.from_booking_id,
          target_schedule_id: targetScheduleId,
        },
        actor_user_id: user.id,
      },
      supabase
    ).catch(() => {});

    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e && e.message === '학원 관리자 권한이 필요합니다.') {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
    console.error('[makeup] error:', e);
    return NextResponse.json({ error: '보강 처리에 실패했습니다.' }, { status: 500 });
  }
}
