/**
 * GET   /api/academy-admin/[academyId]/memberships/[membershipId]
 * PATCH /api/academy-admin/[academyId]/memberships/[membershipId]
 *
 * 폐지는 소프트: is_active = false. DELETE 는 제공하지 않는다.
 */
import { NextRequest } from 'next/server';
import {
  getMembership,
  updateMembership,
  listMembershipDiscounts,
  MembershipError,
} from '@/lib/db/memberships';
import { withStaff, badRequest } from '../_shared';

export const dynamic = 'force-dynamic';
// 운영 화면은 절대 캐시된 DB 읽기를 보면 안 된다 (Next Data Cache 는 디스크에 남는다)
export const fetchCache = 'force-no-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string; membershipId: string }> }
) {
  const { academyId, membershipId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const membership = await getMembership(supabase, academyId, membershipId);
    if (!membership) throw new MembershipError('MEMBERSHIP_NOT_FOUND', '멤버십을 찾을 수 없습니다.');
    return {
      membership,
      discounts: await listMembershipDiscounts(supabase, membershipId, { includeInactive: true }),
    };
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string; membershipId: string }> }
) {
  const { academyId, membershipId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    for (const f of ['name', 'visibility', 'bundled_ticket_id', 'perks_text', 'description', 'is_active']) {
      if (f in body) patch[f] = body[f];
    }
    if (Object.keys(patch).length === 0) badRequest('변경할 필드가 없습니다.');
    if (patch.visibility && !['hidden', 'locked'].includes(patch.visibility as string)) {
      badRequest("visibility 는 'hidden' 또는 'locked' 여야 합니다.");
    }
    return { membership: await updateMembership(supabase, academyId, membershipId, patch) };
  });
}
