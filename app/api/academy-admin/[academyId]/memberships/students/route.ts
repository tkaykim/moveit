/**
 * GET  .../memberships/students            학생 멤버십 목록 (?user_id=, ?status=)
 * POST .../memberships/students            멤버십 부여 (원자적 — 번들 수강권 동시 발급)
 */
import { NextRequest } from 'next/server';
import { listStudentMemberships, grantStudentMembership } from '@/lib/db/memberships';
import type { MembershipStatus } from '@/lib/membership/discount';
import { withStaff, badRequest } from '../_shared';

export const dynamic = 'force-dynamic';
// 운영 화면은 절대 캐시된 DB 읽기를 보면 안 된다 (Next Data Cache 는 디스크에 남는다)
export const fetchCache = 'force-no-store';

const STATUSES: MembershipStatus[] = ['ACTIVE', 'SUSPENDED', 'EXPIRED'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  const sp = new URL(request.url).searchParams;
  const status = sp.get('status') as MembershipStatus | null;
  return withStaff(request, academyId, async ({ supabase }) => {
    if (status && !STATUSES.includes(status)) badRequest('status 값이 올바르지 않습니다.');
    return {
      students: await listStudentMemberships(supabase, academyId, {
        userId: sp.get('user_id') ?? undefined,
        status: status ?? undefined,
      }),
    };
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const body = await request.json().catch(() => ({}));
    if (!body.user_id || typeof body.user_id !== 'string') badRequest('user_id 가 필요합니다.');
    if (!body.membership_id || typeof body.membership_id !== 'string') {
      badRequest('membership_id 가 필요합니다.');
    }
    const result = await grantStudentMembership(supabase, {
      academyId,
      userId: body.user_id,
      membershipId: body.membership_id,
      startDate: body.start_date ?? null,
      endDate: body.end_date ?? null,
      note: body.note ?? null,
      remainingCount: body.remaining_count ?? null,
    });
    return { result };
  });
}
