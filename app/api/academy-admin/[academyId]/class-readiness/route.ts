/**
 * 예약 준비 큐 — 직원 전용 (T8)
 *
 * GET   /api/academy-admin/[academyId]/class-readiness
 *         → 아직 예약을 열 수 없는 수업 목록 (외부 일정툴이 새로 만든 수업이 여기 쌓인다)
 * PATCH /api/academy-admin/[academyId]/class-readiness
 *         Body: { classId, classGroupId?, audienceMembershipId?, bookingPolicy? }
 *         → 수업 1건 태깅
 *
 * 판정·검증은 전부 lib/booking/readiness.ts 가 단일 정본으로 갖는다.
 * 이 라우트가 하는 일: 직원 인증 → 위임 → 에러 매핑 → 감사 기록.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { listNotReadyClasses, tagClass, ReadinessError } from '@/lib/booking/readiness';
import { logTicketEvent } from '@/lib/db/enrollment-activity-log';

export const dynamic = 'force-dynamic';
// 운영 큐는 절대 캐시된 DB 읽기를 보면 안 된다 (Next Data Cache 는 디스크에 남는다)
export const fetchCache = 'force-no-store';

const ADMIN_REQUIRED = '학원 관리자 권한이 필요합니다.';

function fail(e: unknown) {
  if (e instanceof ReadinessError) {
    return NextResponse.json(
      { error: e.message, code: e.code, detail: e.detail },
      { status: e.status }
    );
  }
  if (e && typeof e === 'object' && 'message' in e && (e as Error).message === ADMIN_REQUIRED) {
    return NextResponse.json({ error: ADMIN_REQUIRED }, { status: 403 });
  }
  console.error('[class-readiness] error:', e);
  return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    await assertAcademyAdmin(academyId, user.id);

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const queue = await listNotReadyClasses(createServiceClient() as never, academyId, {
      includeInactive,
    });
    return NextResponse.json({ success: true, ...queue });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    await assertAcademyAdmin(academyId, user.id);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const classId = typeof body.classId === 'string' ? body.classId : null;
    if (!classId) {
      return NextResponse.json({ error: 'classId 가 필요합니다.' }, { status: 400 });
    }

    const supabase = createServiceClient() as never;
    const result = await tagClass(supabase, academyId, classId, {
      ...('classGroupId' in body ? { classGroupId: body.classGroupId as string | null } : {}),
      ...('audienceMembershipId' in body
        ? { audienceMembershipId: body.audienceMembershipId as string | null }
        : {}),
      ...('bookingPolicy' in body ? { bookingPolicy: body.bookingPolicy } : {}),
    });

    await logTicketEvent(
      {
        academy_id: academyId,
        action: 'CLASS_READINESS_TAGGED',
        via: 'manual',
        reason: 'class_readiness',
        context: { class_id: classId, before: result.before, after: result.after },
        actor_user_id: user.id,
      },
      supabase
    ).catch(() => {});

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return fail(e);
  }
}
