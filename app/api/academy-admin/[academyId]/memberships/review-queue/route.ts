/**
 * GET  .../memberships/review-queue    만료 멤버십인데 멤버십 전용 수업의 미래 예약을 아직 보유한 학생
 * POST .../memberships/review-queue    처리 기록 남기기 (누가/언제/무엇을)
 *
 * 데이터 계층만 — UI 는 후속 태스크.
 */
import { NextRequest } from 'next/server';
import {
  getExpiredMembershipReviewQueue,
  recordReviewAction,
  type ReviewActionType,
} from '@/lib/db/memberships';
import { withStaff, badRequest } from '../_shared';

export const dynamic = 'force-dynamic';

const ACTIONS: ReviewActionType[] = ['ACKNOWLEDGED', 'CONTACTED', 'RESOLVED', 'DISMISSED'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  const includeHandled = new URL(request.url).searchParams.get('includeHandled') === 'true';
  return withStaff(request, academyId, async ({ supabase }) => ({
    queue: await getExpiredMembershipReviewQueue(supabase, academyId, { includeHandled }),
  }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withStaff(request, academyId, async ({ supabase, user }) => {
    const body = await request.json().catch(() => ({}));
    if (!body.student_membership_id || typeof body.student_membership_id !== 'string') {
      badRequest('student_membership_id 가 필요합니다.');
    }
    if (!ACTIONS.includes(body.action)) {
      badRequest(`action 은 ${ACTIONS.join(' | ')} 중 하나여야 합니다.`);
    }
    return {
      action: await recordReviewAction(supabase, {
        academyId,
        studentMembershipId: body.student_membership_id,
        bookingId: body.booking_id ?? null,
        action: body.action,
        note: body.note ?? null,
        handledBy: user.id,
      }),
    };
  });
}
