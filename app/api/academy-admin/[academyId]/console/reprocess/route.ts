/**
 * GET /api/academy-admin/[academyId]/console/reprocess   (T9)
 *
 * "조용히 썩는 것이 없어야 한다" 대시보드의 다섯 목록을 한 번에.
 *   ① 이행이 안 끝난 주문 (PAYMENT_APPROVED / FULFILLMENT_FAILED)
 *   ② 실패한 booking_events (attempts / last_error)
 *   ③ 고정 주1회 자동배치 이슈
 *   ④ 만료 멤버십인데 미래 예약이 남은 학생
 *   ⑤ 아직 예약을 열 수 없는 수업 (T8 준비 큐)
 *
 * 각 목록은 이미 존재하는 정본에서 읽는다 — 판정을 여기서 다시 하지 않는다.
 */
import { NextRequest } from 'next/server';
import { getReprocessLists } from '@/lib/db/operator-console';
import { getExpiredMembershipReviewQueue } from '@/lib/db/memberships';
import { listNotReadyClasses } from '@/lib/booking/readiness';
import { withConsoleStaff } from '../_shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withConsoleStaff(request, academyId, async ({ supabase }) => {
    const lists = await getReprocessLists(supabase, academyId, {
      reviewQueue: () => getExpiredMembershipReviewQueue(supabase, academyId),
      notReadyClasses: async () =>
        (await listNotReadyClasses(supabase, academyId)).classes as any[],
    });
    return {
      ...lists,
      counts: {
        stuckOrders: lists.stuckOrders.length,
        failedEvents: lists.failedEvents.length,
        placementIssues: lists.placementIssues.length,
        expiredMembershipBookings: lists.expiredMembershipBookings.length,
        notReadyClasses: lists.notReadyClasses.length,
      },
    };
  });
}
