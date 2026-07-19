/**
 * GET   .../memberships/[membershipId]/discounts   할인 규칙 목록 (비활성 포함)
 * POST  .../memberships/[membershipId]/discounts   할인 규칙 추가
 * PATCH .../memberships/[membershipId]/discounts   할인 규칙 활성/비활성 (소프트 제거)
 *
 * 혜택 제거는 절대 DELETE 하지 않는다 — is_active=false 로 내리고 행은 남긴다.
 */
import { NextRequest } from 'next/server';
import {
  getMembership,
  listMembershipDiscounts,
  upsertMembershipDiscount,
  setMembershipDiscountActive,
  MembershipError,
} from '@/lib/db/memberships';
import { withStaff, badRequest } from '../../_shared';

export const dynamic = 'force-dynamic';

async function assertOwnedMembership(supabase: any, academyId: string, membershipId: string) {
  const m = await getMembership(supabase, academyId, membershipId);
  if (!m) throw new MembershipError('MEMBERSHIP_NOT_FOUND', '멤버십을 찾을 수 없습니다.');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string; membershipId: string }> }
) {
  const { academyId, membershipId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    await assertOwnedMembership(supabase, academyId, membershipId);
    return {
      discounts: await listMembershipDiscounts(supabase, membershipId, { includeInactive: true }),
    };
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string; membershipId: string }> }
) {
  const { academyId, membershipId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    await assertOwnedMembership(supabase, academyId, membershipId);
    const body = await request.json().catch(() => ({}));
    const discount = await upsertMembershipDiscount(supabase, membershipId, {
      class_group_id: body.class_group_id ?? null,
      ticket_id: body.ticket_id ?? null,
      percent: body.percent,
    });
    return { discount };
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string; membershipId: string }> }
) {
  const { academyId, membershipId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    await assertOwnedMembership(supabase, academyId, membershipId);
    const body = await request.json().catch(() => ({}));
    if (!body.discount_id || typeof body.discount_id !== 'string') {
      badRequest('discount_id 가 필요합니다.');
    }
    if (typeof body.is_active !== 'boolean') badRequest('is_active(boolean) 가 필요합니다.');
    return {
      discount: await setMembershipDiscountActive(
        supabase,
        membershipId,
        body.discount_id,
        body.is_active
      ),
    };
  });
}
