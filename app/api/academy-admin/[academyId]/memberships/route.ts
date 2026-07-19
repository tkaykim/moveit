/**
 * GET  /api/academy-admin/[academyId]/memberships        멤버십 정의 목록
 * POST /api/academy-admin/[academyId]/memberships        멤버십 정의 생성
 * 스태프 전용.
 */
import { NextRequest } from 'next/server';
import { listMemberships, createMembership } from '@/lib/db/memberships';
import { withStaff, badRequest } from './_shared';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';
  return withStaff(request, academyId, async ({ supabase }) => ({
    memberships: await listMemberships(supabase, academyId, { includeInactive }),
  }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ academyId: string }> }
) {
  const { academyId } = await params;
  return withStaff(request, academyId, async ({ supabase }) => {
    const body = await request.json().catch(() => ({}));
    if (!body.key || typeof body.key !== 'string') badRequest('key 가 필요합니다.');
    if (!body.name || typeof body.name !== 'string') badRequest('name 이 필요합니다.');
    if (body.visibility && !['hidden', 'locked'].includes(body.visibility)) {
      badRequest("visibility 는 'hidden' 또는 'locked' 여야 합니다.");
    }
    const membership = await createMembership(supabase, academyId, {
      key: body.key,
      name: body.name,
      visibility: body.visibility,
      bundled_ticket_id: body.bundled_ticket_id ?? null,
      perks_text: body.perks_text ?? null,
      description: body.description ?? null,
    });
    return { membership };
  });
}
