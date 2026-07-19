/**
 * POST /api/academy-admin/[academyId]/class-readiness/bulk
 * Body: { classIds: string[], classGroupId?, audienceMembershipId?, bookingPolicy? }
 *
 * 여러 수업을 한 그룹으로 한꺼번에 태깅 — 외부 일정툴이 새 학기에 수업을 무더기로
 * 만들었을 때의 흔한 케이스. 직원 전용.
 *
 * 멱등 — 같은 입력을 두 번 보내도 최종 상태가 같고 두 번째는 unchanged 로 집계된다.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertAcademyAdmin } from '@/lib/supabase/academy-admin-auth';
import { bulkTagClasses, ReadinessError } from '@/lib/booking/readiness';
import { logTicketEvent } from '@/lib/db/enrollment-activity-log';

export const dynamic = 'force-dynamic';
// 운영 큐는 절대 캐시된 DB 읽기를 보면 안 된다 (Next Data Cache 는 디스크에 남는다)
export const fetchCache = 'force-no-store';

const ADMIN_REQUIRED = '학원 관리자 권한이 필요합니다.';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ academyId: string }> }
) {
  try {
    const { academyId } = await params;
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    await assertAcademyAdmin(academyId, user.id);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const classIds = Array.isArray(body.classIds)
      ? body.classIds.filter((v): v is string => typeof v === 'string')
      : null;
    if (!classIds || classIds.length === 0) {
      return NextResponse.json({ error: 'classIds 배열이 필요합니다.' }, { status: 400 });
    }

    const supabase = createServiceClient() as never;
    const result = await bulkTagClasses(supabase, academyId, classIds, {
      ...('classGroupId' in body ? { classGroupId: body.classGroupId as string | null } : {}),
      ...('audienceMembershipId' in body
        ? { audienceMembershipId: body.audienceMembershipId as string | null }
        : {}),
      ...('bookingPolicy' in body ? { bookingPolicy: body.bookingPolicy } : {}),
    });

    await logTicketEvent(
      {
        academy_id: academyId,
        action: 'CLASS_READINESS_BULK_TAGGED',
        via: 'manual',
        reason: 'class_readiness_bulk',
        context: {
          requested: result.requested,
          updated: result.updated,
          unchanged: result.unchanged,
          skipped: result.skipped,
          class_group_id: body.classGroupId ?? null,
        },
        actor_user_id: user.id,
      },
      supabase
    ).catch(() => {});

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    if (e instanceof ReadinessError) {
      return NextResponse.json(
        { error: e.message, code: e.code, detail: e.detail },
        { status: e.status }
      );
    }
    if (e && typeof e === 'object' && 'message' in e && (e as Error).message === ADMIN_REQUIRED) {
      return NextResponse.json({ error: ADMIN_REQUIRED }, { status: 403 });
    }
    console.error('[class-readiness/bulk] error:', e);
    return NextResponse.json({ error: '일괄 태깅에 실패했습니다.' }, { status: 500 });
  }
}
